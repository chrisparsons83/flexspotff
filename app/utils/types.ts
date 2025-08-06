// Doing this because Prisma hates me actually aggregating a sum based on connected fields.
export type ArrElement<ArrType> = ArrType extends readonly (infer ElementType)[]
  ? ElementType
  : never;

// Shared type guards for action data validation
// Type guard to check if action data is a success response with message
export function isSuccessWithMessage(actionData: any): actionData is { success: true; message: string } {
  return actionData?.success === true && 'message' in actionData;
}

// Type guard to check if action data is an error response
export function isErrorResponse(actionData: any): actionData is { success: false; error: any } {
  return actionData?.success === false && 'error' in actionData;
}
