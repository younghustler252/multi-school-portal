/*
| @schoolos/contracts: what the API and the web app agree on.
| One folder per area. Request schemas are zod (the same ones the API validates with); response types describe what comes back.
| The web app imports this package. The API does NOT import it (the API compiles to CommonJS from its own src only); instead
| apps/api/tests/contracts/parity.test.ts runs these schemas and the API's DTOs on the same inputs and FAILS when they disagree.
| So when you change an API DTO, change it here in the same pull request, or that test tells you.
*/
export * from "./errors";
export * from "./automation";
export * from "./message-templates";
export * from "./provisioning";
export * from "./school-settings";
export * from "./platform";
export * from "./report-cards";
export * from "./me-permissions";
