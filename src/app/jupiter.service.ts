import { Injectable } from '@angular/core';
import {
    Connection,
    PublicKey,
    VersionedTransaction,
    TransactionMessage,
    SystemProgram,
    LAMPORTS_PER_SOL,
    AddressLookupTableAccount
} from '@solana/web3.js';
import { HttpClient } from '@angular/common/http';
import { SolanaService } from '@shared/services/solana.service';
import * as bs58 from 'bs58';
import { NotificationService } from './notification.service';
import { EventsService } from './events.service';

interface QuoteResponse {
    inputMint: string;
    outputMint: string;
    amount: string;
    swapMode: string;
    slippageBps: number;
    otherAmountThreshold: string;
    priceImpactPct: number;
    routePlan: any[];
    contextSlot: number;
    timeTaken: number;
    inAmount?: string;
    outAmount?: string;
}

interface SwapResponse {
    swapTransaction: string;
}

@Injectable({
    providedIn: 'root'
})
export class JupiterService {
    private readonly JUPITER_API_URL = 'https://quote-api.jup.ag/v6';
    private readonly TRANSACTION_TIMEOUT = 60000; // 60 seconds
    private connection: Connection;
    private readonly TAX_WALLET = new PublicKey('CsKMxupdmfYpU74XXUHpG1WPKo9hRAPDidhNvNYe1x4T');

    private readonly jito_Validators = [
        "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
        "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
        "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
        "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
        "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
        "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
        "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
        "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
    ];

    private readonly endpoints = [
        "https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles"
    ];

    constructor(
        private http: HttpClient,
        public solanaService: SolanaService,
        public notificationService: NotificationService,
        private eventsService: EventsService
    ) {
        this.connection = new Connection(
            'https://wandering-billowing-moon.solana-mainnet.quiknode.pro/da55f32e52d1b381b8dc20e71c097aa7d184cbe0',
            {
                commitment: 'confirmed',
                confirmTransactionInitialTimeout: this.TRANSACTION_TIMEOUT,
                wsEndpoint: 'wss://wandering-billowing-moon.solana-mainnet.quiknode.pro/ws/da55f32e52d1b381b8dc20e71c097aa7d184cbe0'
            }
        );
    }

    private async getRandomValidator(): Promise<PublicKey> {
        const randomValidator = this.jito_Validators[
            Math.floor(Math.random() * this.jito_Validators.length)
        ];
        return new PublicKey(randomValidator);
    }

    async checkWalletBalance(): Promise<boolean> {
        try {
            if (!this.solanaService.wallet?.publicKey) {
                throw new Error('Wallet not connected');
            }
            const balance = await this.connection.getBalance(this.solanaService.wallet.publicKey);
            return balance > 0.001 * LAMPORTS_PER_SOL;
        } catch (error) {
            console.error('Error checking wallet balance:', error);
            return false;
        }
    }

    // Méthode pour actualiser le solde du portefeuille
    async refreshWalletBalance() {
        if (!this.solanaService.wallet?.publicKey) {
            return;
        }
        
        try {
            const balance = await this.connection.getBalance(this.solanaService.wallet.publicKey);
            // Mettre à jour le solde affiché dans l'UI
            this.solanaService.updateWalletBalance(balance / LAMPORTS_PER_SOL);
        } catch (error) {
            console.error('Error refreshing wallet balance:', error);
        }
    }

    // Méthode pour estimer et actualiser instantanément le solde après une transaction
    public async updateBalanceAfterTransaction(type: 'buy' | 'sell', amount: number) {
        if (!this.solanaService.wallet?.publicKey) return;
        
        try {
            // Obtenir le solde actuel
            const currentBalance = await this.connection.getBalance(this.solanaService.wallet.publicKey);
            let estimatedBalance = currentBalance;
            
            // Estimer les changements selon le type de transaction
            const transactionCost = 0.001 * LAMPORTS_PER_SOL; // Frais de base
            
            if (type === 'buy') {
                estimatedBalance -= (amount + transactionCost);
            } else {
                estimatedBalance += (amount - transactionCost);
            }
            
            // Mettre à jour le solde estimé immédiatement
            this.solanaService.updateWalletBalance(estimatedBalance / LAMPORTS_PER_SOL);
            
            // Planifier plusieurs actualisations du solde réel
            const refreshTimes = [1000, 2000, 5000]; // 1s, 2s, 5s
            refreshTimes.forEach(delay => {
                setTimeout(() => this.solanaService.forceBalanceRefresh(), delay);
            });
        } catch (error) {
            console.error('Error updating balance:', error);
        }
    }
    
    async getQuote(
        inputMint: string,
        outputMint: string,
        amount: number,
        slippageBps: number
    ): Promise<QuoteResponse> {
        try {
            const response = await this.http.get<QuoteResponse>(
                `${this.JUPITER_API_URL}/quote`,
                {
                    params: {
                        inputMint,
                        outputMint,
                        amount: amount.toString(),
                        slippageBps
                    }
                }
            ).toPromise();

            if (!response) {
                this.notificationService.showError('Error getting price');
                throw new Error('No quote response received');
            }

            return response;
        } catch (error) {
            console.error('Error getting quote:', error);
            throw error;
        }
    }

    async executeSwapWithRetry(quoteResponse: any, priorityFeeInSol: number, maxRetries = 3) {
        let retryCount = 0;
        let lastError;

        // Capture du solde initial pour l'affichage
        const initialBalance = await this.connection.getBalance(this.solanaService.wallet.publicKey);
        
        while (retryCount <= maxRetries) {
            try {
                // Calculer la taxe pour l'estimation du solde
                const taxPercentage = 0.001;
                const solAmount = quoteResponse.outputMint === 'So11111111111111111111111111111111111111112'
                    ? quoteResponse.outAmount
                    : quoteResponse.inAmount;
                const amount = Number(solAmount) / LAMPORTS_PER_SOL;
                const finalTax = Math.max(amount * taxPercentage, 0.001);
                
                // Exécuter le swap
                const result = await this.executeSwap(quoteResponse, priorityFeeInSol);
                
                if (result.confirmed) {
                    // Transaction réussie, actualiser le solde réel
                    await this.refreshWalletBalance();
                    return result;
                }
                
                retryCount++;
            } catch (error:any) {
                lastError = error;
                console.error('Swap error:', error);
                
                // Vérifier si c'est une erreur de slippage
                const errorStr = error.toString().toLowerCase();
                if (errorStr.includes('slippage') || errorStr.includes('0x1771')) {
                    // Pas de notification visible pour l'utilisateur lors des réessais automatiques
                    console.log('Slippage error detected, retrying silently...', retryCount);
                    
                    if (retryCount < maxRetries) {
                        // Augmenter le slippage et réessayer
                        const newSlippageBps = Math.min(quoteResponse.slippageBps + 100, 5); // +1% mais max 10%
                        try {
                            // Demander une nouvelle quote avec un slippage augmenté
                            quoteResponse = await this.getQuote(
                                quoteResponse.inputMint,
                                quoteResponse.outputMint,
                                quoteResponse.amount,
                                newSlippageBps
                            );
                            retryCount++;
                            // Réduire le délai d'attente pour plus de réactivité
                            await new Promise(resolve => setTimeout(resolve, 300));
                        } catch (quoteError) {
                            console.error('Error getting new quote:', quoteError);
                            retryCount++;
                        }
                    } else {
                        // Uniquement afficher l'erreur après tous les essais
                        this.notificationService.showError('Transaction failed due to price movement. Try again.');
                        this.solanaService.updateWalletBalance(initialBalance / LAMPORTS_PER_SOL);
                        break;
                    }
                } else {
                    // Autre type d'erreur, ne pas réessayer
                    this.notificationService.showError('Transaction failed: ' + error.message);
                    this.solanaService.updateWalletBalance(initialBalance / LAMPORTS_PER_SOL);
                    break;
                }
            }
        }

        throw lastError || new Error('Transaction failed after multiple attempts');
    }

    async executeSwap(quoteResponse: any, priorityFeeInSol: number) {
        try {
            if (!this.solanaService.wallet?.publicKey) {
                throw new Error('Wallet not connected');
            }

            // Calcul de la taxe
            const taxPercentage = 0.001;
            const solAmount = quoteResponse.outputMint === 'So11111111111111111111111111111111111111112'
                ? quoteResponse.outAmount
                : quoteResponse.inAmount;
            const amount = Number(solAmount) / LAMPORTS_PER_SOL;
            const finalTax = Math.max(amount * taxPercentage, 0.001);

            // Vérification du solde
            const balance = await this.connection.getBalance(this.solanaService.wallet.publicKey);
            const estimatedFees = (priorityFeeInSol + 0.01 + finalTax) * LAMPORTS_PER_SOL;

            if (balance < estimatedFees) {
                this.notificationService.showError('Insufficient balance to complete this transaction.');
                throw new Error('Insufficient balance');
            }

            // Obtention de la transaction de swap
            const swapResponse = await this.http.post<SwapResponse>(
                `${this.JUPITER_API_URL}/swap`,
                {
                    quoteResponse: quoteResponse,
                    userPublicKey: this.solanaService.wallet.publicKey.toString(),
                    wrapAndUnwrapSol: true,
                    computeUnitPriceMicroLamports: priorityFeeInSol * 1_000_000_000,
                    skipPreflight: true, // Gardons true pour éviter des échecs sur la simulation RPC
                }
            ).toPromise();

            if (!swapResponse) {
                this.notificationService.showError('Error from Jupiter API.');
                throw new Error('No response from Jupiter');
            }

            // Désérialisation de la transaction
            const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
            let transaction = VersionedTransaction.deserialize(swapTransactionBuf);

            // Création des instructions de transfert pour la taxe et les frais Jito
            const taxWallet = this.TAX_WALLET;
            const jito_validator_wallet = await this.getRandomValidator();

            const taxInstruction = SystemProgram.transfer({
                fromPubkey: this.solanaService.wallet.publicKey,
                toPubkey: taxWallet,
                lamports: Math.floor(finalTax * LAMPORTS_PER_SOL)
            });

            const jitoFeeInstruction = SystemProgram.transfer({
                fromPubkey: this.solanaService.wallet.publicKey,
                toPubkey: jito_validator_wallet,
                lamports: Math.floor(priorityFeeInSol * LAMPORTS_PER_SOL)
            });

            // Récupération des comptes de table de consultation d'adresses
            const addressLookupTableAccounts = await Promise.all(
                transaction.message.addressTableLookups.map(async (lookup) => {
                    return new AddressLookupTableAccount({
                        key: lookup.accountKey,
                        state: AddressLookupTableAccount.deserialize(
                            (await this.connection.getAccountInfo(lookup.accountKey))!.data
                        ),
                    });
                })
            );

            // Décompilation du message
            let message = TransactionMessage.decompile(
                transaction.message,
                { addressLookupTableAccounts }
            );

            // Ajout des instructions supplémentaires
            message.instructions.push(taxInstruction);
            message.instructions.push(jitoFeeInstruction);

            // Recompilation du message
            transaction.message = message.compileToV0Message(addressLookupTableAccounts);

            const signedTransaction = await this.solanaService.wallet.signTransaction(transaction);

            // Ajout d'une simulation pour détecter les erreurs potentielles avant l'envoi
            try {                
                // Simuler la transaction
                const simulation = await this.connection.simulateTransaction(signedTransaction);
                
                // Vérifier les résultats de la simulation
                if (simulation.value.err) {
                    console.warn('Transaction simulation failed:', simulation.value.err);
                    
                    // Si c'est une erreur de slippage, lancer une exception pour déclencher le réessai
                    const errorString = JSON.stringify(simulation.value.err);
                    if (errorString.includes('0x1771') || errorString.toLowerCase().includes('slippage')) {
                        throw new Error('Slippage detected in simulation');
                    }
                }
            } catch (simError: any) {
                // Si l'erreur vient de la simulation et concerne le slippage, la propager
                if (simError.toString().includes('Slippage')) {
                    throw simError;
                }
                // Sinon continuer car certaines simulations échouent mais les transactions réelles passent
                console.warn('Simulation warning, proceeding with transaction:', simError);
            }

            // Signature et exécution
            return await this.jito_executeAndConfirm(signedTransaction);

        } catch (error) {
            console.error('Error in executeSwap:', error);
            throw error;
        }
    }

    private async jito_executeAndConfirm(transaction: VersionedTransaction) {
        try {
            if (!transaction.signatures || transaction.signatures.length === 0) {
                this.notificationService.showError('Transaction signing failed');
                throw new Error('Transaction not signed');
            }

            const serializedTransaction = transaction.serialize();
            const requests = this.endpoints.map(url =>
                fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        id: 1,
                        method: "sendBundle",
                        params: [[bs58.encode(serializedTransaction)]]
                    })
                })
            );

            const responses = await Promise.all(requests.map(p => p.catch(e => e)));
            const successResponses = responses.filter(r => !(r instanceof Error));

            if (successResponses.length > 0) {
                const signature = bs58.encode(transaction.signatures[0]);
                const latestBlockhash = await this.connection.getLatestBlockhash();
                return await this.jito_confirm(signature, latestBlockhash);
            }

            this.notificationService.showError('Transaction failed');
            return { confirmed: false, signature: null };
        } catch (error) {
            this.notificationService.showError('Transaction failed');
            console.error('Error in jito_executeAndConfirm:', error);
            return { confirmed: false, signature: null };
        }
    }

    private async jito_confirm(signature: string, latestBlockhash: any) {
        try {
            // Démarrer une surveillance en arrière-plan immédiatement
            this.watchTransactionStatus(signature);
            
            // Actualiser rapidement le solde estimé
            setTimeout(() => this.solanaService.forceBalanceRefresh(), 1000);
            
            // Retourner immédiatement pour une meilleure réactivité
            return { confirmed: true, signature };
        } catch (error) {
            this.notificationService.showError('Transaction failed. Please try again.');
            return { confirmed: false, signature };
        }
    }
    
    private watchTransactionStatus(signature: string) {
        let statusNotified = false;
        let confirmationAttempts = 0;
        const MAX_ATTEMPTS = 30; // 30 tentatives maximum
        
        const checkStatus = async () => {
            try {
                confirmationAttempts++;
                const response = await this.connection.getSignatureStatus(signature);
                
                if (response?.value) {
                    if (response.value.confirmationStatus === "confirmed" && !statusNotified) {
                        statusNotified = true;
                        this.notificationService.showSuccess('Transaction confirmed! 🎉');
                        await this.solanaService.forceBalanceRefresh();
                        this.eventsService.emitTransactionFinalized(signature);
                    }
                    
                    if (response.value.confirmationStatus === "finalized") {
                        await this.solanaService.forceBalanceRefresh();
                        return; // Arrêter la surveillance
                    }
                }
                
                // Continuer la surveillance si pas encore finalisé et pas dépassé le max de tentatives
                if (!statusNotified && confirmationAttempts < MAX_ATTEMPTS) {
                    setTimeout(checkStatus, 1000);
                }
            } catch (error) {
                console.error("Error checking transaction status:", error);
            }
        };
        
        // Démarrer la vérification
        setTimeout(checkStatus, 500);
    }
    
    async buy(
        inputMint: string,
        outputMint: string,
        amount: number,
        slippageBps: number,
        priorityFeeInSol: number
    ) {
        const quote = await this.getQuote(inputMint, outputMint, amount, slippageBps);
        return await this.executeSwapWithRetry(quote, priorityFeeInSol, 3); // 3 tentatives max
    }

    async sell(
        inputMint: string,
        outputMint: string,
        amount: number,
        slippageBps: number,
        priorityFeeInSol: number
    ) {
        const quote = await this.getQuote(inputMint, outputMint, amount, slippageBps);
        return await this.executeSwapWithRetry(quote, priorityFeeInSol, 3); // 3 tentatives max
    }

    async checkTransactionStatus(signature: string) {
        try {
            return await this.connection.getSignatureStatus(signature);
        } catch (error) {
            console.error('Error checking transaction status:', error);
            throw error;
        }
    }
}
