import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'

// Never connect anywhere: knex is lazy, so a query is the only thing that would open a connection.
process.env.PG_CONNECTION_STRING = 'postgres://test:test@127.0.0.1:1/test'

const { default: schema } = await import('../src/schema.js')
const { parseLine } = await import('../src/parseLine.js')
const { processLine } = await import('../src/preprocess.js')
const { createPrimaryKey } = await import('../src/utils/createPrimaryKey.js')
const { getIndexForTable } = await import('../src/utils/getIndexForTable.js')
const { getSelectedTables, setTableOption } = await import('../src/selectedTables.js')
const constants = await import('../src/constants.js')

async function collect(stream, lines) {
  const out = []
  Readable.from(lines).pipe(stream)
  for await (const chunk of stream) out.push(chunk)
  return out
}

test('constants have defaults', () => {
  assert.equal(constants.SCHEMA, 'jore')
  assert.equal(constants.INTERMEDIATE_SCHEMA, 'jore_new')
  assert.equal(
    constants.AZURE_UPLOAD_CONTAINER,
    process.env.AZURE_UPLOAD_CONTAINER || 'joredumps'
  )
})

test('schema tables have a filename and fields', () => {
  assert.ok(Object.keys(schema).length > 10)
  assert.equal(schema.stop.filename, 'pysakki.dat')
  for (const table of Object.values(schema)) {
    assert.ok(Array.isArray(table.fields))
  }
})

test('parseLine parses fixed-width fields by type', () => {
  const fields = [
    { length: 3, name: 'id', type: 'string' },
    { length: 2 },
    { length: 4, name: 'count', type: 'integer' },
    { length: 5, name: 'ratio', type: 'decimal' },
    { length: 8, name: 'day', type: 'date' },
    { length: 3, name: 'empty', type: 'string' },
    { length: 2, name: 'fallback', type: 'string', defaultTo: 'x' },
  ]
  // parseLine starts at index 1: the first character of a JORE line is a record marker.
  const line = '#abcXX  4212.5020240131     '
  assert.deepEqual(parseLine(line, fields), {
    id: 'abc',
    count: 42,
    ratio: 12.5,
    day: '2024-01-31',
    empty: null,
    fallback: 'x',
  })
  assert.equal(parseLine('', fields), null)
  assert.throws(() => parseLine('#abcXXnope', fields.slice(0, 3)), /Should be integer/)
})

test('parseLine adds a point for lat/lon fields', () => {
  const fields = [
    { length: 4, name: 'lat', type: 'decimal' },
    { length: 4, name: 'lon', type: 'decimal' },
  ]
  const values = parseLine('#60.124.9', fields)
  assert.equal(values.lat, 60.1)
  assert.equal(values.lon, 24.9)
  assert.ok(values.point)
})

test('processLine drops whitespace-only lines', async () => {
  const out = await collect(processLine('stop'), ['abc', '   ', 'def'])
  assert.deepEqual(out, ['abc\n', 'def\n'])
})

test('processLine renumbers point_geometry indices', async () => {
  const id = 'R'.repeat(24)
  const line = (idx) => `${id}xxxxxxxx${idx}rest`
  const out = await collect(processLine('point_geometry'), [line('0007'), line('0009')])
  assert.deepEqual(out, [`${line('0001')}\n`, `${line('0002')}\n`])
})

test('createPrimaryKey joins key values', () => {
  assert.equal(createPrimaryKey({ a: 1, b: 'x' }, ['a', 'b']), '1_x_')
  assert.equal(createPrimaryKey({ a: 1 }), '')
})

test('getIndexForTable returns primary fields', () => {
  assert.deepEqual(getIndexForTable('stop'), ['stop_id'])
  assert.deepEqual(getIndexForTable('no_such_table'), [])
})

test('selected tables default to all and can be toggled', () => {
  assert.equal(getSelectedTables().selectedTables.length, Object.keys(schema).length)
  setTableOption('stop', false)
  assert.ok(!getSelectedTables().selectedTables.includes('stop'))
  setTableOption('stop', true)
  assert.ok(getSelectedTables().selectedFiles.includes('pysakki.dat'))
})
