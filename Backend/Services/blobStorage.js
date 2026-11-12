const crypto = require("crypto");
const {
  BlobServiceClient,
  BlobSASPermissions,
} = require("@azure/storage-blob");

const UPLOAD_SAS_MINUTES = 15;
const READ_SAS_MINUTES = 120;

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER || "videos";

if (!connectionString) {
  throw new Error("AZURE_STORAGE_CONNECTION_STRING is required in .env");
}

const container =
  BlobServiceClient.fromConnectionString(connectionString).getContainerClient(
    containerName
  );

const minutesFromNow = (minutes) => new Date(Date.now() + minutes * 60 * 1000);

// Blobs are stored as "<userId>/<uuid>.<ext>" so a user can only claim their own uploads.
exports.newBlobName = (userId, extension) =>
  `${userId}/${crypto.randomUUID()}${extension}`;

exports.isOwnBlob = (blobName, userId) =>
  typeof blobName === "string" &&
  blobName.startsWith(`${userId}/`) &&
  !blobName.includes("..");

// Short-lived URL the browser uses to PUT the file straight into Blob Storage.
exports.uploadUrl = (blobName) =>
  container.getBlockBlobClient(blobName).generateSasUrl({
    permissions: BlobSASPermissions.parse("cw"),
    expiresOn: minutesFromNow(UPLOAD_SAS_MINUTES),
  });

// Short-lived read-only URL used as the <video> src; the container itself stays private.
exports.readUrl = (blobName) =>
  container.getBlockBlobClient(blobName).generateSasUrl({
    permissions: BlobSASPermissions.parse("r"),
    expiresOn: minutesFromNow(READ_SAS_MINUTES),
  });

exports.getProperties = (blobName) =>
  container.getBlockBlobClient(blobName).getProperties();

exports.deleteBlob = (blobName) =>
  container.getBlockBlobClient(blobName).deleteIfExists();
