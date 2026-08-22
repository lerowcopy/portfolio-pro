import { describe, expect, it, vi } from "vitest";
import { freeKassaCallbackSignature } from "./freekassa";
import { handleFreeKassaWebhook } from "./freekassaWebhook";

const config = { shopId: "7012", secretWord2: "callback-secret", enforceIpAllowlist: false };
const orderId = "11111111-1111-4111-8111-111111111111";

function createResponse() {
  const response = {
    status: vi.fn(),
    type: vi.fn(),
    send: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.type.mockReturnValue(response);
  return response;
}

function createPool(eventRowCount: number) {
  const query = vi.fn()
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce({ rows: [{ id: orderId, user_id: "22222222-2222-4222-8222-222222222222", plan: "pro", expected_amount_kopeks: 49_000, period_days: 30, status: "pending" }] })
    .mockResolvedValueOnce({ rowCount: eventRowCount })
    .mockResolvedValue(undefined);
  const client = { query, release: vi.fn() };
  return { connect: vi.fn().mockResolvedValue(client), client };
}

function validRequest() {
  const AMOUNT = "490.00";
  return {
    ip: "127.0.0.1",
    body: {
      MERCHANT_ID: "7012",
      AMOUNT,
      intid: "123456",
      MERCHANT_ORDER_ID: orderId,
      SIGN: freeKassaCallbackSignature("7012", AMOUNT, config.secretWord2, orderId),
    },
  };
}

describe("FreeKassa Result URL handler", () => {
  it("activates a matching pending order and acknowledges with YES", async () => {
    const pool = createPool(1);
    const response = createResponse();
    await handleFreeKassaWebhook(validRequest() as never, response as never, { pool: pool as never, getConfig: () => config });

    expect(pool.client.query).toHaveBeenCalledWith("commit");
    expect(response.send).toHaveBeenCalledWith("YES");
    expect(response.status).not.toHaveBeenCalled();
  });

  it("acknowledges an already processed intid without second entitlement mutation", async () => {
    const pool = createPool(0);
    const response = createResponse();
    await handleFreeKassaWebhook(validRequest() as never, response as never, { pool: pool as never, getConfig: () => config });

    expect(pool.client.query).toHaveBeenCalledTimes(4);
    expect(response.send).toHaveBeenCalledWith("YES");
  });

  it("rejects an invalid signature before opening a database connection", async () => {
    const pool = createPool(1);
    const response = createResponse();
    const request = validRequest();
    request.body.SIGN = "0".repeat(32);
    await handleFreeKassaWebhook(request as never, response as never, { pool: pool as never, getConfig: () => config });

    expect(pool.connect).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith("INVALID");
  });
});
