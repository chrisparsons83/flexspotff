import type {
  AbortMultipartUploadCommandOutput,
  CompleteMultipartUploadCommandOutput,
} from '@aws-sdk/client-s3';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import {
  unstable_composeUploadHandlers,
  unstable_createMemoryUploadHandler,
  writeAsyncIterableToWritable,
} from '@remix-run/node';
import { parseStream } from 'music-metadata';
import { PassThrough } from 'stream';
import z from 'zod';

interface S3FileData
  extends AbortMultipartUploadCommandOutput,
    CompleteMultipartUploadCommandOutput {
  ETag: string;
  Bucket: string;
  Key: string;
  Location: string;
}

export const podcastJsonSchema = z.object({
  location: z.string(),
  size: z.number().optional(),
  duration: z.number(),
});
export type S3FileUpload = z.infer<typeof podcastJsonSchema>;

const s3Client = new S3Client({
  endpoint: process.env.AWS_ENDPOINT,
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const uploadStream = (Key: string, contentType: string) => {
  const pass = new PassThrough();
  const metadata = parseStream(pass, { mimeType: contentType });
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.AWS_BUCKET,
      Key,
      Body: pass,
      ACL: 'public-read',
    },
    leavePartsOnError: false,
  });

  return {
    writeStream: pass,
    promise: upload.done(),
    metadata,
  };
};

const uploadImageToS3 = async (
  data: AsyncIterable<Uint8Array>,
  name: string,
  contentType: string,
) => {
  const stream = uploadStream(name, contentType);
  await writeAsyncIterableToWritable(data, stream.writeStream);
  const file = (await stream.promise) as S3FileData;
  const extraMetadata = await stream.metadata;
  const metadata = await s3Client.send(
    new HeadObjectCommand({ Bucket: file.Bucket, Key: file.Key }),
  );
  const duration = extraMetadata.format.duration
    ? Math.floor(extraMetadata.format.duration)
    : 0;
  const returnObject: S3FileUpload = {
    location: `https://${file.Location}`,
    size: metadata.ContentLength,
    duration,
  };
  return returnObject;
};

const s3UploadHandler = unstable_composeUploadHandlers(
  // our custom upload handler
  async ({ name, contentType, data, filename }) => {
    if (name !== 'podcastFile' || !filename) {
      return undefined;
    }
    const keyName = filename ?? `${name}${+new Date()}`;
    const uploadedImage: any = await uploadImageToS3(
      data,
      keyName,
      contentType,
    );
    return JSON.stringify(uploadedImage);
  },
  // fallback to memory for everything else
  unstable_createMemoryUploadHandler(),
);

export { s3UploadHandler };
