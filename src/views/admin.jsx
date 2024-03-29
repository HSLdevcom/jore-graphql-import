import React from "react";
import StatusIndicator from "./components/StatusIndicator.jsx";
import DailyImport from "./components/DailyImport.jsx";
import SelectTables from "./components/SelectTables.jsx";
import UploadExport from "./components/UploadExport.jsx";

const AdminView = ({
  isImporting,
  latestImportedFile,
  selectedTables,
  manualDumpInProgress,
  PATH_PREFIX,
}) => {
  return (
    <>
      <h1>JORE import admin</h1>
      <StatusIndicator
        isImporting={isImporting}
        latestImportedFile={latestImportedFile}
      />
      <hr />
      <DailyImport
        disabled={isImporting || manualDumpInProgress}
        PATH_PREFIX={PATH_PREFIX}
      />
      <UploadExport
        disabled={isImporting || manualDumpInProgress}
        PATH_PREFIX={PATH_PREFIX}
      />
      <SelectTables
        disabled={isImporting}
        selectedTables={selectedTables}
        PATH_PREFIX={PATH_PREFIX}
      />

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
