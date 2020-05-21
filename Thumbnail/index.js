const stream = require("stream");
const Jimp = require("jimp");

const {
  StorageSharedKeyCredential,
  newPipeline,
  BlobServiceClient,
} = require("@azure/storage-blob");

const ONE_MEGABYTE = 1024 * 1024;
const ONE_MINUTE = 60 * 1000;
const uploadOptions = { bufferSize: 4 * ONE_MEGABYTE, maxBuffers: 20 };

const containerName = process.env.BLOB_CONTAINER_NAME;
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accessKey = process.env.AZURE_STORAGE_ACCOUNT_ACCESS_KEY;

const sharedKeyCredential = new StorageSharedKeyCredential(
  accountName,
  accessKey
);
const pipeline = newPipeline(sharedKeyCredential);
const serviceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  pipeline
);

module.exports = (context, eventGridEvent, inputBlob) => {
  const widthInPixels = 100;
  const contentType = context.bindingData.data.contentType;
  const blobUrl = context.bindingData.data.url;
  const blobName = blobUrl.slice(blobUrl.lastIndexOf("/") + 1);

  Jimp.read(inputBlob).then((thumbnail) => {
    thumbnail.resize(widthInPixels, Jimp.AUTO);

    const options = {
      contentSettings: { contentType: contentType },
    };

    thumbnail.getBuffer(Jimp.MIME_PNG, async (err, buffer) => {
      const readStream = stream.PassThrough();
      readStream.end(buffer);

      const containerClient = serviceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      try {
        await blockBlobClient.uploadStream(
          readStream,
          uploadOptions.bufferSize,
          uploadOptions.maxBuffers,
          { blobHTTPHeaders: { blobContentType: "image/jpeg" } }
        ).timeout(30 * ONE_MINUTE);
      } catch (err) {
        context.log(err.message);
      } finally {
        context.done();
      }
    });
  });
};
