import { Writable } from 'stream'

import { uniqBy } from 'lodash-es'

import schema from './schema.js'
import { parseLine } from './parseLine.js'
import { upsert } from './utils/upsert.js'
import { getIndexForTable } from './utils/getIndexForTable.js'
import { createPrimaryKey } from './utils/createPrimaryKey.js'
import { getPrimaryConstraint } from './utils/getPrimaryConstraint.js'
import { getKnex } from './knex.js'

const { knex } = getKnex()
const NS_PER_SEC = 1e9

const createImportQuery = (insertOptions) =>
  new Promise((resolve, reject) => {
    const time = process.hrtime()
    knex
      .transaction((trx) => upsert({ ...insertOptions, trx }))
      .then(() => {
        resolve(time)
      })
      .catch((err) => reject(err))
  })

const hasProhibitedNulls = (parsedLine, lineSchema) => {
  let notAllowedNulls = false
  const notNullableKeys = []
  lineSchema.forEach((field) => {
    if (field.notNullable) {
      notNullableKeys.push(field.name)
    }
  })

  notNullableKeys.forEach((key) => {
    const value = parsedLine[key]
    if (value === null) {
      notAllowedNulls = true
    }
  })

  return notAllowedNulls
}

const BATCH_SIZE = 1000
// Max insert batches waiting in the shared queue. When reached, the import
// streams stop reading their files until the DB catches up, which keeps
// memory bounded no matter how slow the inserts are.
const MAX_QUEUED_BATCHES = 40

export const createImportStreamForTable = async (tableName, resolveFileImport, queue) => {
  const { fields, lineSchema = fields } = schema[tableName] || {}
  const primaryKeys = getIndexForTable(tableName)
  const constraint = await getPrimaryConstraint(tableName)

  let rowsCache = []
  let linesReceived = false
  const pendingInserts = new Set()

  const insertRows = (rows) => {
    let insertItems = rows

    // Remove duplicates, there might be some
    if (primaryKeys.length !== 0) {
      insertItems = uniqBy(insertItems, (item) => createPrimaryKey(item, primaryKeys))
    }

    const insertPromise = queue
      .add(() =>
        createImportQuery({
          tableName,
          data: insertItems,
          indices: primaryKeys,
          constraint,
        }).then((time) => {
          const [execS, execNs] = process.hrtime(time)
          const ms = (execS * NS_PER_SEC + execNs) / 1000000
          console.log(`Records of ${tableName} imported in ${ms} ms`)
        })
      )
      .finally(() => pendingInserts.delete(insertPromise))

    pendingInserts.add(insertPromise)
    return insertPromise
  }

  const importStream = new Writable({
    objectMode: true,
    write(chunk, encoding, callback) {
      if (!chunk || !lineSchema) {
        return callback()
      }

      if (!linesReceived) {
        console.log(`Importing ${tableName}...`)
        linesReceived = true
      }

      let parsedLine
      try {
        parsedLine = parseLine(chunk, lineSchema)
      } catch (err) {
        return callback(err)
      }

      if (hasProhibitedNulls(parsedLine, lineSchema)) {
        return callback()
      }

      rowsCache.push(parsedLine)

      if (rowsCache.length < BATCH_SIZE) {
        return callback()
      }

      insertRows(rowsCache).catch((err) => importStream.destroy(err))
      rowsCache = []

      // Backpressure: holding the callback until the queue has room pauses
      // the upstream pipe, and with it the file read.
      return queue.onSizeLessThan(MAX_QUEUED_BATCHES).then(() => callback(), callback)
    },
    final(callback) {
      if (rowsCache.length !== 0) {
        // Errors are surfaced through Promise.all below
        insertRows(rowsCache).catch(() => {})
        rowsCache = []
      }

      Promise.all([...pendingInserts])
        .then(() => {
          console.log(`${tableName} imported!`)
          resolveFileImport()
          callback()
        })
        .catch((err) => callback(err))
    },
  })

  return importStream
}
