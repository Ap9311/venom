/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PostType = 'text' | 'image' | 'poll' | 'qa';

export interface Post {
  id: string;
  type: PostType;
  title: string;
  content: string;
  imageUrl?: string; // Optimized WebP base64 string for zero-trace image hosting
  pollOptions?: string[]; // Up to 10 options
  pollVotes?: { [key: string]: number }; // Map of option index -> vote count
  correctOptionIndex?: number; // For Q&A type, optional correct option
  upvotesCount: number;
  downvotesCount: number;
  likesCount: number;
  commentsCount: number;
  createdAt: any; // Firestore Timestamp
  encryptedHash: string; // Fake cyber hash (e.g. "SHA-256: 4e8b3...")
  category: string; // e.g. "leaks", "ideas", "general"
  postedFromIp?: string; // Stored user IP for admin visibility
  postedFromDevice?: string; // Stored user agent details for admin
  postedFromImei?: string; // Stored device IMEI for admin visibility
  reactions?: { [key: string]: number }; // Reaction counts (love, fire, laugh, wow, like, angry)
}

export interface Comment {
  id: string;
  content: string;
  likesCount: number;
  repliesCount: number;
  createdAt: any; // Firestore Timestamp
}

export interface Reply {
  id: string;
  content: string;
  likesCount: number;
  createdAt: any; // Firestore Timestamp
}

export interface UserInteractionState {
  likedPosts: string[]; // List of postIds liked
  votedPosts: { [postId: string]: 'up' | 'down' }; // postId -> vote direction
  votedPolls: { [postId: string]: number }; // postId -> optionIndex chosen
  likedComments: string[]; // commentId or postId_commentId -> boolean
  likedReplies: string[]; // replyId or commentId_replyId -> boolean
  reactedPosts?: { [postId: string]: string }; // postId -> reactionKey ('love', 'fire', 'laugh', 'wow', 'like', 'angry')
}
