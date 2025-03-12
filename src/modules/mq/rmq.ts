import amqp from "amqplib";
import { debugLog, errorLog } from "../../utils/logging.js";
import { MESSAGE_RETRIES } from "../../utils/consts.js";
import { AutocompleteOption, PhoneData } from "../../types/index.js";
import {
  GetAutocompleteOptionsRequestPayload,
  GetMatchingSlugRequestPayload,
  GetKimovilDataRequestPayload,
} from "../../types/payloads.js";

let channel: amqp.Channel;

// Function to get queue-specific config
const getQueueConfig = (queueName: string) => ({
  durable: true,
  arguments: {
    "x-message-ttl": 300000, // 5 minutes TTL
    "x-dead-letter-exchange": "dlx",
    "x-dead-letter-routing-key": `${queueName}_dead`,
  },
});

export const initRMQ = async () => {
  const rmqConnstr = process.env.RMQ_CONNSTR;
  if (!rmqConnstr) {
    throw new Error("RMQ_CONNSTR is not available in env.");
  }

  const connection = await amqp.connect(rmqConnstr);
  channel = await connection.createChannel();

  // Setup dead letter exchange
  await channel.assertExchange("dlx", "direct", { durable: true });

  // Setup dead letter queues for each main queue
  const queues = [
    "getAutocompleteOptionsRequest",
    "getMatchingSlugRequest",
    "getUserConfirmedSlugRequest",
    "getKimovilDataRequest",
    "getKimovilDataResponse",
    "getMissingSlugsRequest.auto",
    "getKimovilDataRequest.auto",
    "errorResponse",
    "errorResponse.auto",
  ];

  for (const queue of queues) {
    await channel.assertQueue(queue, getQueueConfig(queue));
    const deadQueueName = `${queue}_dead`;
    await channel.assertQueue(deadQueueName, { durable: true });
    await channel.bindQueue(deadQueueName, "dlx", deadQueueName);
  }

  console.log(`Initialized RMQ channel.`);
};

export const onMessage = (
  queueName: string,
  processCallback: (payload: any) => Promise<any>
) => {
  // Use queue-specific config
  channel.assertQueue(queueName, getQueueConfig(queueName));

  channel.consume(queueName, async (msg) => {
    if (!msg) return;

    debugLog(`Processing ${queueName} message.`);

    try {
      const payload = JSON.parse(msg.content.toString());
      const { retries: _, ...cleanPayload } = payload;

      const result = await processCallback(cleanPayload);
      await successCallbacks[queueName]?.(result, cleanPayload);

      debugLog(`Successfully processed ${queueName} message.`);
    } catch (error) {
      errorLog(
        `Failed to process ${queueName} message:`,
        error,
        "Trying to requeue..."
      );

      try {
        const payload = JSON.parse(msg.content.toString());
        payload.retries = (payload.retries || 0) + 1;

        if (payload.retries < MESSAGE_RETRIES) {
          channel.sendToQueue(queueName, Buffer.from(JSON.stringify(payload)), {
            persistent: true,
          });
        } else {
          errorLog(
            `Failed to process ${queueName} message after ${MESSAGE_RETRIES} retries. Dropping it. Message was:`,
            msg.content.toString()
          );

          let errorQueueName = "errorResponse";
          if (queueName.includes("auto")) {
            errorQueueName += ".auto";
          }

          channel.sendToQueue(
            errorQueueName,
            Buffer.from(
              JSON.stringify({
                queue: queueName,
                payload,
                error: error?.toString() ?? error,
              })
            ),
            { persistent: true }
          );
        }
      } catch (requeueError) {
        errorLog(`Failed to requeue ${queueName} message:`, requeueError);
      }
    } finally {
      channel.ack(msg);
    }
  });

  debugLog(`Initialized RMQ ${queueName} consumer.`);
};

const successCallbacks: Record<
  string,
  (result: any, payload: any) => Promise<void>
> = {
  getAutocompleteOptionsRequest: async (
    result: AutocompleteOption[],
    payload: GetAutocompleteOptionsRequestPayload
  ) => {
    // Use queue-specific config
    await channel.assertQueue(
      "getMatchingSlugRequest",
      getQueueConfig("getMatchingSlugRequest")
    );
    channel.sendToQueue(
      "getMatchingSlugRequest",
      Buffer.from(
        JSON.stringify({
          userId: payload.userId,
          deviceId: payload.deviceId,
          options: result,
        })
      ),
      { persistent: true }
    );
  },

  getMatchingSlugRequest: async (
    result: string,
    payload: GetMatchingSlugRequestPayload
  ) => {
    // Use queue-specific config
    await channel.assertQueue(
      "getUserConfirmedSlugRequest",
      getQueueConfig("getUserConfirmedSlugRequest")
    );
    channel.sendToQueue(
      "getUserConfirmedSlugRequest",
      Buffer.from(
        JSON.stringify({
          userId: payload.userId,
          deviceId: payload.deviceId,
          slug: result,
          options: payload.options,
        })
      ),
      { persistent: true }
    );
  },

  getKimovilDataRequest: async (
    result: PhoneData,
    payload: GetKimovilDataRequestPayload
  ) => {
    const saveResult = await fetch(
      `${process.env.COD_URL!}/api/ext/save-kimovil-data`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            ":" + process.env.COD_SECRET!
          ).toString("base64")}`,
        },
        body: JSON.stringify({ ...result, deviceId: payload.deviceId }),
      }
    );

    if (!saveResult.ok) {
      throw new Error(
        `COD failed to save data to database: ${await saveResult.json()}`
      );
    }

    // Use queue-specific config
    await channel.assertQueue(
      "getKimovilDataResponse",
      getQueueConfig("getKimovilDataResponse")
    );
    channel.sendToQueue(
      "getKimovilDataResponse",
      Buffer.from(
        JSON.stringify({
          userId: payload.userId,
          deviceId: payload.deviceId,
        })
      ),
      { persistent: true }
    );
  },

  "getKimovilDataRequest.auto": async (
    result: PhoneData,
    payload: GetKimovilDataRequestPayload
  ) => {
    const saveResult = await fetch(
      `${process.env.SCHEDULER_URL!}/api/kimovil/data`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            ":" + process.env.COD_SECRET!
          ).toString("base64")}`,
        },
        body: JSON.stringify({ ...result, deviceId: payload.deviceId }),
      }
    );

    if (!saveResult.ok) {
      throw new Error(
        `Scheduler failed to save data to database: ${await saveResult.json()}`
      );
    }

    // TODO add response queue
    // await channel.assertQueue(
    //   "getKimovilDataResponse",
    //   getQueueConfig("getKimovilDataResponse")
    // );
    // channel.sendToQueue(
    //   "getKimovilDataResponse",
    //   Buffer.from(
    //     JSON.stringify({
    //       userId: payload.userId,
    //       deviceId: payload.deviceId,
    //     })
    //   ),
    //   { persistent: true }
    // );
  },

  "getMissingSlugsRequest.auto": async (result: {
    slugs: {
      name: string;
      slug: string;
      rawSlug: string;
      releaseMonth: string | null;
      scores: string;
      brand?: string;
    }[];
    brand?: string;
    lastPage: number;
  }) => {
    if (result.slugs.length === 0) {
      return;
    }

    const saveResult = await fetch(
      `${process.env.SCHEDULER_URL!}/api/kimovil/slugs`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            ":" + process.env.COD_SECRET!
          ).toString("base64")}`,
        },
        body: JSON.stringify(result.slugs),
      }
    );

    if (!saveResult.ok) {
      throw new Error(
        `Scheduler failed to save slugs to database: ${await saveResult.json()}`
      );
    }

    const logLastPageResult = await fetch(
      `${process.env.SCHEDULER_URL!}/api/kimovil/brand/log-last-page`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            ":" + process.env.COD_SECRET!
          ).toString("base64")}`,
        },
        body: JSON.stringify({
          brand: result.brand,
          lastPage: result.lastPage,
        }),
      }
    );

    if (!logLastPageResult.ok) {
      throw new Error(
        `Scheduler failed to log last page: ${await logLastPageResult.json()}`
      );
    }

    channel.sendToQueue(
      "getMissingSlugsResponse.auto",
      Buffer.from(JSON.stringify(true)),
      { persistent: true }
    );
  },
};
