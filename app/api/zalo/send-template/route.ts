import { NextResponse } from "next/server";

const ZALO_SEND_TEMPLATE_URL = "https://business.openapi.zalo.me/message/template";

type TemplateType = "confirm" | "review";

const getTemplateId = (type: TemplateType) => {
  if (type === "confirm") return process.env.ZALO_TEMPLATE_CONFIRM_ID;
  if (type === "review") return process.env.ZALO_TEMPLATE_REVIEW_ID;
  return undefined;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type = body.type as TemplateType;
    const phone = String(body.phone || "").replace(/\D/g, "");
    const templateData = body.templateData || {};
    const trackingId = body.trackingId || `beenmedia-${type}-${Date.now()}`;

    const accessToken = process.env.ZALO_OA_ACCESS_TOKEN;
    const templateId = getTemplateId(type);

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Chưa cấu hình ZALO_OA_ACCESS_TOKEN trong file .env.local",
        },
        { status: 400 }
      );
    }

    if (!templateId) {
      return NextResponse.json(
        {
          success: false,
          message:
            type === "confirm"
              ? "Chưa cấu hình ZALO_TEMPLATE_CONFIRM_ID trong file .env.local"
              : "Chưa cấu hình ZALO_TEMPLATE_REVIEW_ID trong file .env.local",
        },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        { success: false, message: "Thiếu SĐT khách để gửi Zalo OA" },
        { status: 400 }
      );
    }

    const zaloPayload = {
      phone,
      template_id: templateId,
      template_data: templateData,
      tracking_id: trackingId,
    };

    const zaloResponse = await fetch(ZALO_SEND_TEMPLATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: accessToken,
      },
      body: JSON.stringify(zaloPayload),
    });

    const result = await zaloResponse.json().catch(() => ({}));

    if (!zaloResponse.ok || result.error !== 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            result.message ||
            result.error_message ||
            "Zalo OA từ chối gửi template",
          zalo: result,
          sent_payload: zaloPayload,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      zalo: result,
      sent_payload: zaloPayload,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Lỗi hệ thống khi gửi Zalo OA",
      },
      { status: 500 }
    );
  }
}
