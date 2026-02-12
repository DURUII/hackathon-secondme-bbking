import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth-helper";

export async function POST(req: Request) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { questionId?: string };
    const questionId = body.questionId?.trim();

    if (!questionId) {
      return NextResponse.json(
        { success: false, error: "questionId is required" },
        { status: 400 }
      );
    }

    const ownedQuestion = await db.question.findFirst({
      where: {
        id: questionId,
        userId: user.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!ownedQuestion) {
      return NextResponse.json(
        { success: false, error: "Question not found or no permission" },
        { status: 404 }
      );
    }

    await db.question.update({
      where: { id: questionId },
      data: { deletedAt: new Date() },
    });
    await db.questionSubscription.deleteMany({
      where: { questionId },
    });

    return NextResponse.json({
      success: true,
      data: { questionId },
    });
  } catch (error) {
    console.error("[QUESTION_DELETE] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete question" },
      { status: 500 }
    );
  }
}
