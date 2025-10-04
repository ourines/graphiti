/**
 * Context Manager for GraphiTi MCP Server
 *
 * Manages conversation context across tool calls, enabling:
 * - Manual context switching via set_context tool
 * - Automatic priority_group_id injection in search_memory
 * - Context persistence during server lifetime
 *
 * Design Philosophy:
 * - Keep it simple: No LLM-based auto-detection
 * - User-controlled: Explicit context setting via tools
 * - Zero latency: Pure in-memory state management
 * - Practical: Automatically enhance searches with current context
 */

export interface ConversationContext {
  /**
   * Currently active group_id (project/workspace)
   * This will be used as priority_group_id in searches
   */
  currentGroupId: string | null;

  /**
   * Track recently used group_ids
   * Useful for quick context switching
   */
  recentGroupIds: string[];

  /**
   * Last updated timestamp
   */
  lastUpdated: Date | null;
}

export class ContextManager {
  private context: ConversationContext;
  private readonly MAX_RECENT_GROUPS = 10;

  constructor() {
    this.context = {
      currentGroupId: null,
      recentGroupIds: [],
      lastUpdated: null,
    };
  }

  /**
   * Update recent groups list with MRU (Most Recently Used) behavior
   * @private
   */
  private updateRecentGroups(groupId: string): void {
    if (!this.context.recentGroupIds.includes(groupId)) {
      this.context.recentGroupIds.unshift(groupId);

      // Keep only MAX_RECENT_GROUPS
      if (this.context.recentGroupIds.length > this.MAX_RECENT_GROUPS) {
        this.context.recentGroupIds = this.context.recentGroupIds.slice(0, this.MAX_RECENT_GROUPS);
      }
    } else {
      // Move to front (most recently used)
      this.context.recentGroupIds = [
        groupId,
        ...this.context.recentGroupIds.filter(id => id !== groupId)
      ];
    }
  }

  /**
   * Set the current conversation context (group_id)
   * This will be used to prioritize search results
   */
  setContext(groupId: string): void {
    this.context.currentGroupId = groupId;
    this.context.lastUpdated = new Date();
    this.updateRecentGroups(groupId);
  }

  /**
   * Get the current context (group_id)
   */
  getCurrentContext(): string | null {
    return this.context.currentGroupId;
  }

  /**
   * Clear the current context
   */
  clearContext(): void {
    this.context.currentGroupId = null;
    this.context.lastUpdated = new Date();
  }

  /**
   * Get recently used group_ids
   */
  getRecentGroups(): string[] {
    return [...this.context.recentGroupIds];
  }

  /**
   * Get full context state (for debugging)
   */
  getContextState(): ConversationContext {
    return {
      currentGroupId: this.context.currentGroupId,
      recentGroupIds: [...this.context.recentGroupIds],
      lastUpdated: this.context.lastUpdated,
    };
  }

  /**
   * Auto-detect group_id from recent operations
   * Called when user adds memory to track active context
   */
  trackGroupUsage(groupId: string): void {
    this.updateRecentGroups(groupId);

    // Auto-set context if none is set
    if (!this.context.currentGroupId) {
      this.context.currentGroupId = groupId;
      this.context.lastUpdated = new Date();
    }
  }
}
