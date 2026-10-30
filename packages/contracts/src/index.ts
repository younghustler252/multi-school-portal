/*
| @schoolos/contracts: what the API and the web app agree on.
| One folder per area. Request schemas are zod (the same ones the API validates with); response types describe what comes back.
| STATUS: written from the API's DTOs and use cases. The API does not import from here yet (switch it over after the first root
| `npm install`, one area at a time), so when you change an API DTO, change it here in the same pull request.
*/
export * from "./errors";
export * from "./automation";
export * from "./message-templates";
export * from "./provisioning";
export * from "./school-settings";
