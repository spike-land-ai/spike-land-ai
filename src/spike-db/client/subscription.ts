import { serialize } from "../protocol/messages.js";
import type { Connection } from "./connection.js";

export interface SubscriptionHandle {
  unsubscribe(): void;
}

export class SubscriptionBuilder {
  private appliedHandler?: () => void;
  private errorHandler?: (err: Error) => void;

  constructor(
    private queries: Array<{ table: string; filter?: Record<string, unknown> }>,
    private id: string,
    private connection: Connection,
  ) {}

  onApplied(handler: () => void): this {
    this.appliedHandler = handler;
    return this;
  }

  onError(handler: (err: Error) => void): this {
    this.errorHandler = handler;
    return this;
  }

  /** Called internally when the initial_snapshot arrives for this subscription. */
  _notifyApplied(): void {
    this.appliedHandler?.();
  }

  /** Called internally when a subscription error occurs. */
  _notifyError(err: Error): void {
    this.errorHandler?.(err);
  }

  subscribe(): SubscriptionHandle {
    this.connection.send(
      serialize({
        type: "subscribe" as const,
        id: this.id,
        queries: this.queries,
      }),
    );

    const id = this.id;
    const connection = this.connection;

    return {
      unsubscribe() {
        connection.send(
          serialize({
            type: "unsubscribe" as const,
            subscriptionId: id,
          }),
        );
      },
    };
  }
}
