export interface Coin {
    mint: string;
    name: string;
    for_you_id?: number;
    raydium_pool: boolean;
    image_uri?: string;
    usd_market_cap?: number;
    symbol?: string;
}

// services/trending-coin.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class TrendingCoinService {
    private readonly isTestGroup: boolean = false;
    private coinsSubject = new BehaviorSubject<Coin[]>([]);
    public coins$ = this.coinsSubject.asObservable();

    constructor() {
 
    }

    private getCategorisedCoins(coins: Coin[]): {
        trendingCoins: Coin[];
        nonTrendingCoins: Coin[];
        graduatedCoins: Coin[];
        customForYouCoins: Coin[];
    } {
        // Créer un Map pour compter les apparitions
        const appearanceCount = new Map<string, number>();
        coins.forEach(coin => {
            const count = appearanceCount.get(coin.mint) || 0;
            appearanceCount.set(coin.mint, count + 1);
        });
    
        // Filtrer les coins selon les critères (marketcap, apparitions min et max)
        const eligibleCoins = coins.filter(coin => {
            const minMarketCap = coin.usd_market_cap ? coin.usd_market_cap >= 8000 : false;
            const appearances = appearanceCount.get(coin.mint) || 0;
            const validAppearances = appearances >= 0 && appearances <= 2; // Entre 3 et 4 apparitions
            return minMarketCap && validAppearances;
        });
    
        const trendingCoins = eligibleCoins.filter(coin => 
            coin.for_you_id !== undefined && coin.for_you_id % 7 === 0
        );
    
        const nonTrendingCoins = eligibleCoins.filter(coin => 
            !trendingCoins.includes(coin)
        );
    
        const graduatedCoins = nonTrendingCoins.filter(coin => 
            coin.raydium_pool
        );
    
        const customForYouCoins = nonTrendingCoins.filter(coin => 
            !coin.raydium_pool
        );
    
        return {
            trendingCoins,
            nonTrendingCoins,
            graduatedCoins,
            customForYouCoins
        };
    }
    
    
    private getGraduatedCoinProbability(coinCount: number): number {
        if (coinCount <= 2) return 0.66;
        if (coinCount <= 5) return 0.50;
        return 0.25;
    }

    private shouldSelectTrendingCoin(coinCount: number): boolean {
        const threshold = this.isTestGroup
            ? (coinCount > 5 ? 0.85 : 0.90)
            : (coinCount > 5 ? 0.80 : 0.85);

        return Math.random() < threshold;
    }

    private calculateWeights(coins: Coin[], excludedCoins: Set<string> = new Set()): Map<Coin, [number, number]> {
        const availableCoins = coins.filter(coin => 
            !excludedCoins.has(coin.mint)
        );

        if (availableCoins.length === 0) return new Map();

        const weight = 1 / availableCoins.length;
        let currentRange = 0;

        return new Map(
            availableCoins.map(coin => {
                const range: [number, number] = [currentRange, currentRange + weight];
                currentRange += weight;
                return [coin, range];
            })
        );
    }

    private selectRandomCoin(coins: Coin[], excludedCoins: Set<string> = new Set()): Coin | null {
        const weights = this.calculateWeights(coins, excludedCoins);
        if (weights.size === 0) return null;

        const random = Math.random();
        for (const [coin, [min, max]] of weights) {
            if (random >= min && random < max) {
                return coin;
            }
        }

        return null;
    }

    public createNewSelection(currentCoins: Coin[], targetCount: number): Coin[] {
        const {
            trendingCoins,
            graduatedCoins,
            customForYouCoins
        } = this.getCategorisedCoins(currentCoins);

        const selectedCoins = new Set<string>();
        const result: Coin[] = [];
        const maxAttempts = targetCount * 2;
        let attempts = 0;

        while (result.length < targetCount && attempts < maxAttempts) {
            const shouldSelectTrending = this.shouldSelectTrendingCoin(customForYouCoins.length);
            let selectedCoin: Coin | null = null;

            if (shouldSelectTrending && trendingCoins.length > 0) {
                selectedCoin = this.selectRandomCoin(trendingCoins, selectedCoins);
            } else {
                const useGraduated = Math.random() < this.getGraduatedCoinProbability(customForYouCoins.length);
                const sourceCoins = useGraduated ? graduatedCoins : customForYouCoins;
                selectedCoin = this.selectRandomCoin(sourceCoins, selectedCoins);
            }

            if (selectedCoin && !selectedCoins.has(selectedCoin.mint)) {
                result.push(selectedCoin);
                selectedCoins.add(selectedCoin.mint);
            }

            attempts++;
        }

        // Compléter avec les coins actuels si nécessaire
        if (result.length < targetCount) {
            for (const coin of currentCoins) {
                if (!selectedCoins.has(coin.mint)) {
                    result.push(coin);
                    if (result.length === targetCount) break;
                }
            }
        }

        return result;
    }

    // Méthodes publiques
    public updateCoins(coins: Coin[]): void {
        this.coinsSubject.next(coins);
    }

    public refreshSelection(): void {
        const currentCoins = this.coinsSubject.value;
        const newSelection = this.createNewSelection(currentCoins, currentCoins.length);
        this.coinsSubject.next(newSelection);
    }
}
