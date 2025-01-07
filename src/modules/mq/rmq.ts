import amqp from "amqplib";
import { debugLog, errorLog } from "../../utils/logging";
import { MESSAGE_RETRIES } from "../../utils/consts";
import { AutocompleteOption, PhoneData } from "../../types";
import {
  GetAutocompleteOptionsRequestPayload,
  GetMatchingSlugRequestPayload,
  GetKimovilDataRequestPayload,
} from "../../types/payloads";

let channel: amqp.Channel;

export const initRMQ = async () => {
  const rmqConnstr = process.env.RMQ_CONNSTR;
  if (!rmqConnstr) {
    throw new Error("RMQ_CONNSTR is not available in env.");
  }

  const connection = await amqp.connect(rmqConnstr);
  channel = await connection.createChannel();

  console.log(`Initialized RMQ channel.`);
};

export const onMessage = (
  queueName: string,
  processCallback: (payload: any) => Promise<any>
) => {
  channel.assertQueue(queueName, { durable: true });

  channel.consume(queueName, async (msg) => {
    if (!msg) return;

    debugLog(`Processing ${queueName} message.`);

    try {
      const payload = JSON.parse(msg.content.toString());
      const { retries: _, ...cleanPayload } = payload;

      const result = await processCallback(cleanPayload);
      await successCallbacks[queueName]?.(result, cleanPayload);
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
            msg
          );

          channel.sendToQueue(
            "errorResponse",
            Buffer.from(
              JSON.stringify({
                requestType: queueName,
                userId: payload.userId,
                error,
              })
            ),
            { persistent: true }
          );
        }
      } catch (requeueError) {
        errorLog(`Failed to requeue ${queueName} message:`, requeueError);
      }
    } finally {
      debugLog(`Successfully processed ${queueName} message.`);
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
    channel.sendToQueue(
      "getMatchingSlugRequest",
      Buffer.from(
        JSON.stringify({
          userId: payload.userId,
          deviceId: payload.deviceId,
          options: result,
        })
      )
    );
  },

  getMatchingSlugRequest: async (
    result: string,
    payload: GetMatchingSlugRequestPayload
  ) => {
    channel.sendToQueue(
      "getUserConfirmedSlugRequest",
      Buffer.from(
        JSON.stringify({
          userId: payload.userId,
          deviceId: payload.deviceId,
          slug: result,
          options: payload.options,
        })
      )
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

    channel.sendToQueue(
      "getKimovilDataResponse",
      Buffer.from(
        JSON.stringify({
          userId: payload.userId,
          deviceId: payload.deviceId,
        })
      )
    );
  },
};
