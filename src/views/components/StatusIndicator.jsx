/* eslint-disable camelcase */
import React from "react";
import { format } from "date-fns";

const DATE_FORMAT = "HH:mm:ss YYYY-MM-DD";

const StatusIndicator = ({ isImporting, latestImportedFile = {} }) => {
  const { filename = "", import_start, import_end, success = false } =
    latestImportedFile || {};

  return (
    <>
      <h4 style={{ color: isImporting ? "red" : "green" }}>
        {isImporting ? "Import in progress!" : "Standing by..."}
      </h4>
      {filename && (
        <p>
          {success &&
            import_end && (
              <>
                The latest imported export was <strong>{filename}</strong>. The import
                started at <strong>{format(import_start, DATE_FORMAT)}</strong> and{" "}
                <strong style={{ color: "green" }}>ended successfully</strong> at{" "}
                <strong>{format(import_end, DATE_FORMAT)}</strong>.{" "}
              </>
            )}
          {!success &&
            import_end && (
              <>
                The latest imported export was <strong>{filename}</strong>. The import
                started at <strong>{format(import_start, DATE_FORMAT)}</strong> but
                finished <strong style={{ color: "red" }}>unsuccessfully</strong> at{" "}
                <strong>{format(import_end, DATE_FORMAT)}</strong>.
              </>
            )}
          {!success &&
            !import_end && (
              <>
                The currently running file is <strong>{filename}</strong>. The import
                started at <strong>{format(import_start, DATE_FORMAT)}</strong>.
              </>
            )}
        </p>
      )}
    </>
  );
};

export default StatusIndicator;
