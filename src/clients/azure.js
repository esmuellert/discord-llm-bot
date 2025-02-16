import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { AZURE_ENDPOINT, AZURE_KEY } from "../config/constants.js";

export const azureClient = new ModelClient(
  AZURE_ENDPOINT,
  new AzureKeyCredential(AZURE_KEY)
);
