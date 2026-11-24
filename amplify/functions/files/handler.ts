import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireMember, type ResolverEvent } from '../shared/group';

const s3 = new S3Client({});
const Bucket = process.env.BUCKET_NAME!;

/** The key must live in the project's folder, otherwise no access. */
function checkKey(group: string, key: string | null | undefined): string {
  if (!key || !key.startsWith(`projects/${group}/`) || key.includes('..')) {
    throw new Error('Ungültiger Dateipfad.');
  }
  return key;
}

export const handler = async (event: ResolverEvent) => {
  const args = event.arguments;
  const group = requireMember(event, args.group);
  const Key = checkKey(group, args.key);

  switch (event.info.fieldName) {
    case 'fileUrl':
      if (args.action === 'upload') {
        return getSignedUrl(
          s3,
          new PutObjectCommand({ Bucket, Key, ContentType: args.contentType ?? 'application/octet-stream' }),
          { expiresIn: 300 }
        );
      }
      return getSignedUrl(s3, new GetObjectCommand({ Bucket, Key, ResponseContentDisposition: 'inline' }), {
        expiresIn: 300,
      });

    case 'deleteFile':
      await s3.send(new DeleteObjectCommand({ Bucket, Key }));
      return true;

    default:
      throw new Error(`Unknown field ${event.info.fieldName}`);
  }
};
