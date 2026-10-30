import { Queue } from "bullmq";
import { redisConnection } from "../connection";

/*
|--------------------------------------------------------------------------
| PROVISION SCHEMA QUEUE
| Triggered on school signup
| Job: create new PostgreSQL schema, run baseline migrations,
|      seed default grading config + term structure
|--------------------------------------------------------------------------
*/

export interface ProvisionSchemaJobData {
    schoolId:   string;
    subdomain:  string;
    schoolName: string;
}

export const provisionSchemaQueue = new Queue<ProvisionSchemaJobData>(
    "provision-schema",
    { connection: redisConnection },
);

export const addProvisionSchemaJob = async (
    data: ProvisionSchemaJobData,
): Promise<void> => {
    await provisionSchemaQueue.add("provision", data, {
        attempts:    3,
        backoff: {
            type:  "exponential",
            delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail:     false,
    });
};