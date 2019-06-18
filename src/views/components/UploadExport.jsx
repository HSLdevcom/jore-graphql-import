import React from "react";
import { PATH_PREFIX } from "../../constants";

const UploadExport = ({ disabled }) => {
  return (
    <>
      <h3>Upload an export archive</h3>
      <form
        id="export-upload"
        action={`${PATH_PREFIX}upload`}
        method="post"
        encType="multipart/form-data"
      >
        <fieldset disabled={disabled}>
          <legend>Select file</legend>
          <input type="file" name="export" />
          <input type="submit" value="Upload" />
        </fieldset>
      </form>
    </>
  );
};

export default UploadExport;
