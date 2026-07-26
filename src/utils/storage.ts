/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserInteractionState } from '../types';

const STORAGE_KEY = 'venom_user_interactions';

const defaultState: UserInteractionState = {
  likedPosts: [],
  votedPosts: {},
  votedPolls: {},
  likedComments: [],
  likedReplies: [],
  reactedPosts: {},
};

export function getInteractionState(): UserInteractionState {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return {
        likedPosts: [],
        votedPosts: {},
        votedPolls: {},
        likedComments: [],
        likedReplies: [],
        reactedPosts: {},
      };
    }
    const parsed = JSON.parse(data);
    return {
      likedPosts: parsed.likedPosts || [],
      votedPosts: parsed.votedPosts || {},
      votedPolls: parsed.votedPolls || {},
      likedComments: parsed.likedComments || [],
      likedReplies: parsed.likedReplies || [],
      reactedPosts: parsed.reactedPosts || {},
    };
  } catch (e) {
    console.error('Failed to read interaction state', e);
    return {
      likedPosts: [],
      votedPosts: {},
      votedPolls: {},
      likedComments: [],
      likedReplies: [],
      reactedPosts: {},
    };
  }
}

export function saveInteractionState(state: UserInteractionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save interaction state', e);
  }
}

export function isPostLiked(postId: string): boolean {
  const state = getInteractionState();
  return state.likedPosts.includes(postId);
}

export function togglePostLikeStore(postId: string): boolean {
  const state = getInteractionState();
  const index = state.likedPosts.indexOf(postId);
  let liked = false;
  if (index === -1) {
    state.likedPosts.push(postId);
    liked = true;
  } else {
    state.likedPosts.splice(index, 1);
  }
  saveInteractionState(state);
  return liked;
}

export function getPostVote(postId: string): 'up' | 'down' | null {
  const state = getInteractionState();
  return state.votedPosts[postId] || null;
}

export function setPostVoteStore(postId: string, direction: 'up' | 'down' | null): void {
  const state = getInteractionState();
  if (direction === null) {
    delete state.votedPosts[postId];
  } else {
    state.votedPosts[postId] = direction;
  }
  saveInteractionState(state);
}

export function getPollVotedOption(postId: string): number | null {
  const state = getInteractionState();
  return state.votedPolls[postId] !== undefined ? state.votedPolls[postId] : null;
}

export function setPollVotedOptionStore(postId: string, optionIndex: number): void {
  const state = getInteractionState();
  state.votedPolls[postId] = optionIndex;
  saveInteractionState(state);
}

export function isCommentLiked(commentKey: string): boolean {
  const state = getInteractionState();
  return state.likedComments.includes(commentKey);
}

export function toggleCommentLikeStore(commentKey: string): boolean {
  const state = getInteractionState();
  const index = state.likedComments.indexOf(commentKey);
  let liked = false;
  if (index === -1) {
    state.likedComments.push(commentKey);
    liked = true;
  } else {
    state.likedComments.splice(index, 1);
  }
  saveInteractionState(state);
  return liked;
}

export function isReplyLiked(replyKey: string): boolean {
  const state = getInteractionState();
  return state.likedReplies.includes(replyKey);
}

export function toggleReplyLikeStore(replyKey: string): boolean {
  const state = getInteractionState();
  const index = state.likedReplies.indexOf(replyKey);
  let liked = false;
  if (index === -1) {
    state.likedReplies.push(replyKey);
    liked = true;
  } else {
    state.likedReplies.splice(index, 1);
  }
  saveInteractionState(state);
  return liked;
}

export function getPostReaction(postId: string): string | null {
  const state = getInteractionState();
  if (!state.reactedPosts) return null;
  return state.reactedPosts[postId] || null;
}

export function setPostReactionStore(postId: string, reactionKey: string | null): void {
  const state = getInteractionState();
  if (!state.reactedPosts) {
    state.reactedPosts = {};
  }
  if (reactionKey === null) {
    delete state.reactedPosts[postId];
  } else {
    state.reactedPosts[postId] = reactionKey;
  }
  saveInteractionState(state);
}
