import { Injectable, OnDestroy } from '@angular/core';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { TokenService } from './token.service';

interface FeedPost {
  id: string;
  content: string;
  user_id: string;
  coin_id: string;
  likes_count: number;
  replies_count: number;
  created_at: string;
  user: {
    id: string;
    wallet_address: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class FeedService implements OnDestroy {
  private supabase;
  private posts$ = new BehaviorSubject<FeedPost[]>([]);
  private currentChannel: RealtimeChannel | null = null;
  private currentCoinId: string | null = null;
  private sessionToken: string | null = null;

  constructor(public tokenService: TokenService) {
    this.supabase = createClient(
      "https://souctnjaypcptqpeeuhh.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdWN0bmpheXBjcHRxcGVldWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzMDc3MTgsImV4cCI6MjA0OTg4MzcxOH0.mvglwt-o25YOehjdeM29yZg2TtoDiDJayKhtOTf8XG4"
    );
  }

  ngOnDestroy() {
    this.unsubscribeFromFeed();
  }

  // Getter pour l'Observable des posts
  getPosts(): Observable<FeedPost[]> {
    return this.posts$.asObservable();
  }

  // Mise à jour du token de session
  setSessionToken(token: string) {
    this.sessionToken = token;
  }

  // Gestion de la subscription realtime
  subscribeToFeed(coinId: string | null) {
    // Si on est déjà subscribed au même coin, on ne fait rien
    if (this.currentCoinId === coinId) return;

    // Désabonnement de l'ancien feed si existant
    this.unsubscribeFromFeed();

    // Mise à jour du coinId courant
    this.currentCoinId = coinId;

    // Création du nouveau channel
    this.currentChannel = this.supabase
      .channel(`feed:${coinId || 'all'}`)
      .on('postgres_changes', 
        {
          event: '*',
          schema: 'public',
          table: 'feed_posts',
          ...(coinId ? { filter: `coin_id=eq.${coinId}` } : {})
        },
        payload => this.handleRealtimeUpdate(payload)
      )
      .subscribe();
  }

  // Désabonnement du feed
  unsubscribeFromFeed() {
    if (this.currentChannel) {
      this.currentChannel.unsubscribe();
      this.currentChannel = null;
    }
    this.currentCoinId = null;
  }

  // Gestion des mises à jour realtime
  private handleRealtimeUpdate(payload: any) {
    const currentPosts = this.posts$.value;
    
    switch (payload.eventType) {
      case 'INSERT':
        this.posts$.next([payload.new, ...currentPosts]);
        break;
      
      case 'UPDATE':
        this.posts$.next(
          currentPosts.map(post => 
            post.id === payload.new.id ? payload.new : post
          )
        );
        break;
      
      case 'DELETE':
        this.posts$.next(
          currentPosts.filter(post => post.id !== payload.old.id)
        );
        break;
    }
  }

  // Récupération du feed
  async getFeed(page = 0, sort = 'recent', coinId: string | null = null) {
    try {
     const jwt:any = 'e'
      const { data, error } = await this.supabase.functions.invoke('feed', {
        body: { 
          method: 'getFeed',
          query: { page, sort, coinId }
        },
        headers: jwt ? {
          'Session-Token': jwt
        } : undefined
      });

      if (error) throw error;

      if (page === 0) {
        this.posts$.next(data);
      } else {
        this.posts$.next([...this.posts$.value, ...data]);
      }

      return data;
    } catch (error) {
      console.error('Error fetching feed:', error);
      throw error;
    }
  }

  // Création d'un post
  async createPost(content: string, coinId: string) {
    try {
      const { data, error } = await this.supabase.functions.invoke('feed', {
        body: {
          method: 'createPost',
          query: { content, coinId }
        },
        headers: {
          'Session-Token': this.sessionToken!
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  // Toggle like sur un post
  async toggleLike(postId: string) {
    try {
      const { data, error } = await this.supabase.functions.invoke('feed', {
        body: {
          method: 'toggleLike',
          query: { postId }
        },
        headers: {
          'Session-Token': this.sessionToken!
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error toggling like:', error);
      throw error;
    }
  }

  // Création d'une réponse
  async createReply(postId: string, content: string) {
    try {
      const { data, error } = await this.supabase.functions.invoke('feed', {
        body: {
          method: 'createReply',
          query: { postId, content }
        },
        headers: {
          'Session-Token': this.sessionToken!
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating reply:', error);
      throw error;
    }
  }

  // Rafraîchissement du feed
  async refreshFeed() {
    return this.getFeed(0, 'recent', this.currentCoinId);
  }
}
