export interface InvoiceUpload {
  id: string; organizationId: string; fileId: string; sha256: string; filename: string;
  status: "queued" | "review" | "recorded" | "dismissed"; version: number;
  extractedJson?: string; issuesJson: string; invoiceId?: string;
  uploadedByMembershipId: string; createdAt: string; updatedAt: string;
}
