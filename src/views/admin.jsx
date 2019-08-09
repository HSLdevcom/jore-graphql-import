import React from "react";
import StatusIndicator from "./components/StatusIndicator";
import DailyImport from "./components/DailyImport";
import SelectTables from "./components/SelectTables";
import UploadExport from "./components/UploadExport";
import { PATH_PREFIX } from "../constants";

const AdminView = ({
  isImporting,
  latestImportedFile,
  selectedTables,
  manualDumpInProgress,
}) => {
  return (
    <>
      <h1>JORE import admin</h1>
      <StatusIndicator
        isImporting={isImporting}
        latestImportedFile={latestImportedFile}
      />
      <hr />
      <DailyImport disabled={isImporting || manualDumpInProgress} />
      <UploadExport disabled={isImporting || manualDumpInProgress} />
      <SelectTables disabled={isImporting} selectedTables={selectedTables} />

      <h3>Run geometry matcher</h3>
      <form action={`${PATH_PREFIX}run-geometry-matcher`} method="post">
        <input type="submit" value="Run geometry matcher" />
      </form>

      <h3>Create foreign keys</h3>
      <form action={`${PATH_PREFIX}create-foreign-keys`} method="post">
        <input type="submit" value="Create foreign keys" />
      </form>

      <h3>Create functions</h3>
      <form action={`${PATH_PREFIX}create-functions`} method="post">
        <input type="submit" value="Create functions" />
      </form>

      <h3>Upload dump of DB</h3>

      {manualDumpInProgress && <p>Dump in progress.</p>}
      {isImporting && <p>Dump disabled during import.</p>}

      <form action={`${PATH_PREFIX}dump-upload`} method="post">
        <input
          disabled={isImporting || manualDumpInProgress}
          type="submit"
          value="Create and upload dump"
        />
      </form>
    </>
  );
};

export default AdminView;
