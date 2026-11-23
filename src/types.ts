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
  imageUrl?: string;
  pollOptions?: string[];
  pollVotes?: { [key: string]: number };
  correctOptionIndex?: number;
  upvotesCount: number;
  downvotesCount: number;
  likesCount: number;
  commentsCount: number;
  reportsCount?: number;
  isDeleted?: boolean;
  createdAt: any;
  encryptedHash: string;
  category: string;
  ownerUid?: string;
  reactions?: { [key: string]: number };
}

export interface Comment {
  id: string;
  content: string;
  likesCount: number;
  repliesCount: number;
  createdAt: any;
}

export interface Reply {
  id: string;
  content: string;
  likesCount: number;
  createdAt: any;
}

export interface UserInteractionState {
  likedPosts: string[];
  votedPosts: { [postId: string]: 'up' | 'down' };
  votedPolls: { [postId: string]: number };
  likedComments: string[];
  likedReplies: string[];
  reactedPosts?: { [postId: string]: string };
  reportedPosts?: string[];
}
