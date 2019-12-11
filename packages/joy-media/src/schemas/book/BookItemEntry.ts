
/** This file is generated based on JSON schema. Do not modify. */

import * as Yup from 'yup';

export const BookItemEntryValidationSchema = Yup.object().shape({
  // No validation rules.
});

export type BookItemEntryType = {
  formatAndFileType: any
  object?: any
};

export const BookItemEntryClass = {
  formatAndFileType: {
    "name": "Format and File Type",
    "description": "The file format, extension and additional metadata for the book item entry.",
    "required": true,
    "type": "Internal",
    "classId": "Book Entry Format"
  },
  object: {
    "name": "Object",
    "description": "The entityId of the object in the data directory.",
    "type": "Internal",
    "classId": "Media Object"
  }
};
