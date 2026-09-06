import { base44 } from './base44Client';

// UploadFile is safe to call from client code (user-scoped file storage).
// All other Core integrations (InvokeLLM, SendEmail, GenerateImage, etc.)
// are restricted — they are invoked through backend functions to protect
// integration credits and apply server-side validation.
export const UploadFile = base44.integrations.Core.UploadFile;