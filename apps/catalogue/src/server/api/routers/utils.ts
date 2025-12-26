import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/src/server/api/trpc";

export const utilsRouter = createTRPCRouter({
  /**
   * Basic greeting endpoint for testing
   * @param text Text to include in greeting
   * @returns Greeting message
   */
  hello: publicProcedure
    .input(z.object({ text: z.string().transform((val) => val.trim()) }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),
});
