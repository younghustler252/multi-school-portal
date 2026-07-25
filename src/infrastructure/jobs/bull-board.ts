import { createBullBoard }      from "@bull-board/api";
import { BullMQAdapter }        from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter }       from "@bull-board/express";
import { provisionSchemaQueue } from "./queues/provision-schema.queue";
import { notificationQueue }    from "./queues/notification.queue";
import { reportCardQueue }      from "./queues/report-card.queue";

/*
|--------------------------------------------------------------------------
| BULL BOARD
| Visual dashboard for monitoring BullMQ queues
| Access at: /admin/queues
| Protected by super admin auth
|--------------------------------------------------------------------------
*/

export const createBullBoardRouter = () => {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath("/admin/queues");

    createBullBoard({
        queues: [
            new BullMQAdapter(provisionSchemaQueue),
            new BullMQAdapter(notificationQueue),
            new BullMQAdapter(reportCardQueue),
        ],
        serverAdapter,
    });

    return serverAdapter.getRouter();
};