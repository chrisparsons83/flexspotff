// Doing this because Prisma hates me actually aggregating a sum based on connected fields.
export type ArrElement<ArrType> = ArrType extends readonly (infer ElementType)[]
  ? ElementType
  : never;
