import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth-helper";

export async function GET() {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db.questionSubscription.findMany({
      where: { userId: user.id, question: { deletedAt: null } },
      select: { questionId: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        questionIds: rows.map((row) => row.questionId),
      },
    });
  } catch (error) {
    console.error("[SUBSCRIPTION][GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { questionId?: string; subscribed?: boolean };
    const questionId = body.questionId?.trim();
    const subscribed = Boolean(body.subscribed);

    if (!questionId) {
      return NextResponse.json(
        { success: false, error: "questionId is required" },
        { status: 400 }
      );
    }

    const questionExists = await db.question.findFirst({
      where: { id: questionId, deletedAt: null },
      select: { id: true },
    });

    if (!questionExists) {
      return NextResponse.json(
        { success: false, error: "Question not found" },
        { status: 404 }
      );
    }

    if (subscribed) {
      await db.questionSubscription.upsert({
        where: {
          userId_questionId: {
            userId: user.id,
            questionId,
          },
        },
        update: {},
        create: {
          userId: user.id,
          questionId,
        },
      });
    } else {
      await db.questionSubscription.deleteMany({
        where: {
          userId: user.id,
          questionId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        questionId,
        subscribed,
      },
    });
  } catch (error) {
    console.error("[SUBSCRIPTION][POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}
