import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import {
  unstable_composeUploadHandlers,
  unstable_createMemoryUploadHandler,
  writeAsyncIterableToWritable,
} from "@remix-run/node";
import { PassThrough } from "stream";

const uploadStream = (Key: string) => {
  const s3Client = new S3Client({
    endpoint: process.env.AWS_ENDPOINT,
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  const pass = new PassThrough();
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.AWS_BUCKET,
      Key,
      Body: pass,
    },
    leavePartsOnError: false,
  });
  return {
    writeStream: pass,
    promise: upload.done(),
  };
};

const uploadImageToS3 = async (
  data: AsyncIterable<Uint8Array>,
  name: string
) => {
  const stream = uploadStream(name);
  await writeAsyncIterableToWritable(data, stream.writeStream);
  // TODO: Figure out why file insists Location isn't on the object
  const file = (await stream.promise) as any;
  return file.Location;
};

const s3UploadHandler = unstable_composeUploadHandlers(
  // our custom upload handler
  async ({ name, contentType, data, filename }) => {
    if (name !== "podcastFile") {
      return undefined;
    }
    const keyName = filename ?? `${name}${+new Date()}`;
    const uploadedImage = await uploadImageToS3(data, keyName);
    return uploadedImage;
  },
  // fallback to memory for everything else
  unstable_createMemoryUploadHandler()
);

export { s3UploadHandler };
