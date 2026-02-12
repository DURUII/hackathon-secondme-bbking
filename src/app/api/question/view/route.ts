import { NextResponse } from "next/server";
import { getOrCreateParticipant, getUserFromToken } from "@/lib/auth-helper";
import { db } from "@/lib/db";
import { VoteTaskManager } from "@/lib/vote-task-manager";

export async function POST(request: Request) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { questionId } = await request.json();
    if (!questionId || typeof questionId !== "string") {
      return NextResponse.json({ success: false, error: "questionId is required" }, { status: 400 });
    }

    const question = await db.question.findUnique({
      where: { id: questionId },
      select: { id: true },
    });
    if (!question) {
      return NextResponse.json({ success: false, error: "Question not found" }, { status: 404 });
    }

    const participant = await getOrCreateParticipant(user);
    await VoteTaskManager.enqueue(question.id, participant.id);

    return NextResponse.json({
      success: true,
      data: {
        questionId: question.id,
        participantId: participant.id,
        queued: true,
      },
    });
  } catch (error) {
    console.error("[QUESTION_VIEW] Error:", error);
    return NextResponse.json({ success: false, error: "Failed to enqueue question view" }, { status: 500 });
  }
}
