import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

function serializePost(post: any) {
  const id = post._id;
  return {
    ...post,
    _id: id != null && typeof id !== "string" ? String(id) : id,
    userId: post.user_id ?? post.userId,
    displayName: post.display_name ?? post.displayName,
    upvotedBy: post.upvoted_by ?? post.upvotedBy ?? [],
    commentCount: post.comment_count ?? post.commentCount ?? 0,
    createdAt: post.created_at ?? post.createdAt,
  };
}

export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get("tag") || "";
  const sort = request.nextUrl.searchParams.get("sort") || "recent";
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || "30"), 50);

  try {
    const db = await getDb();
    const filter: any = {};
    if (tag) filter.tags = tag;

    const raw = await db
      .collection("community_posts")
      .find(filter)
      .limit(Math.min(limit * 4, 120))
      .toArray();

    const postTime = (p: any) =>
      new Date(p.created_at ?? p.createdAt ?? 0).getTime();

    const sorted = [...raw].sort((a, b) => {
      if (sort === "popular") {
        const uv = (b.upvotes || 0) - (a.upvotes || 0);
        return uv !== 0 ? uv : postTime(b) - postTime(a);
      }
      return postTime(b) - postTime(a);
    });

    const posts = sorted.slice(0, limit);

    return NextResponse.json(posts.map(serializePost), { headers: CORS });
  } catch (err: any) {
    console.error("Error fetching posts:", err.message);
    return NextResponse.json([], { headers: CORS });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId = "demo-user", displayName = "Anonymous", title, body, tags = [] } =
      await request.json();

    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json(
        { error: "Title and body are required" },
        { status: 400, headers: CORS }
      );
    }

    const post = {
      user_id: userId,
      display_name: displayName,
      title: title.trim(),
      body: body.trim(),
      tags: tags.filter(Boolean),
      upvotes: 0,
      upvoted_by: [],
      comment_count: 0,
      created_at: new Date(),
    };

    const db = await getDb();
    const result = await db.collection("community_posts").insertOne(post);

    return NextResponse.json(
      { ...serializePost(post), _id: result.insertedId },
      { status: 201, headers: CORS }
    );
  } catch (err: any) {
    console.error("Error creating post:", err);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500, headers: CORS }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { postId, userId = "demo-user", action } = await request.json();

    if (!postId || action !== "upvote") {
      return NextResponse.json(
        { error: "postId and action='upvote' required" },
        { status: 400, headers: CORS }
      );
    }

    const db = await getDb();
    const post = await db
      .collection("community_posts")
      .findOne({ _id: new ObjectId(postId) });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404, headers: CORS });
    }

    const upvotedBy = post.upvoted_by ?? post.upvotedBy ?? [];
    const alreadyUpvoted = upvotedBy.includes(userId);

    if (alreadyUpvoted) {
      await db.collection("community_posts").updateOne(
        { _id: new ObjectId(postId) },
        { $inc: { upvotes: -1 }, $pull: { upvoted_by: userId } as any }
      );
    } else {
      await db.collection("community_posts").updateOne(
        { _id: new ObjectId(postId) },
        { $inc: { upvotes: 1 }, $push: { upvoted_by: userId } as any }
      );
    }

    return NextResponse.json(
      { upvoted: !alreadyUpvoted, upvotes: post.upvotes + (alreadyUpvoted ? -1 : 1) },
      { headers: CORS }
    );
  } catch (err: any) {
    console.error("Error upvoting post:", err);
    return NextResponse.json(
      { error: "Failed to upvote" },
      { status: 500, headers: CORS }
    );
  }
}
