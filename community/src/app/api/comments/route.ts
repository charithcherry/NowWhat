import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

function serializeComment(comment: any) {
  return {
    ...comment,
    postId: comment.post_id ?? comment.postId,
    userId: comment.user_id ?? comment.userId,
    displayName: comment.display_name ?? comment.displayName,
    createdAt: comment.created_at ?? comment.createdAt,
  };
}

export async function GET(request: NextRequest) {
  const postId = request.nextUrl.searchParams.get("postId");

  if (!postId) {
    return NextResponse.json(
      { error: "postId is required" },
      { status: 400, headers: CORS }
    );
  }

  try {
    const db = await getDb();
    const comments = await db
      .collection("community_comments")
      .find({
        $or: [{ post_id: postId }, { postId: postId }],
      })
      .toArray();

    const t = (c: any) => new Date(c.created_at ?? c.createdAt ?? 0).getTime();
    comments.sort((a, b) => t(a) - t(b));

    return NextResponse.json(comments.map(serializeComment), { headers: CORS });
  } catch (err: any) {
    console.error("Error fetching comments:", err.message);
    return NextResponse.json([], { headers: CORS });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
    }

    const { postId, displayName = user.name || "Anonymous", body } = await request.json();
    const userId = user.userId;

    if (!postId || !body?.trim()) {
      return NextResponse.json(
        { error: "postId and body are required" },
        { status: 400, headers: CORS }
      );
    }

    const comment = {
      post_id: postId,
      user_id: userId,
      display_name: displayName,
      body: body.trim(),
      created_at: new Date(),
    };

    const db = await getDb();
    const result = await db.collection("community_comments").insertOne(comment);

    await db.collection("community_posts").updateOne(
      { _id: new ObjectId(postId) },
      { $inc: { comment_count: 1 } }
    );

    return NextResponse.json(
      { ...serializeComment(comment), _id: result.insertedId },
      { status: 201, headers: CORS }
    );
  } catch (err: any) {
    console.error("Error creating comment:", err);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500, headers: CORS }
    );
  }
}
