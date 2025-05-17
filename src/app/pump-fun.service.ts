import { Injectable } from '@angular/core';
import {
    Keypair,
    PublicKey,
    SystemProgram,
    ComputeBudgetProgram,
    Connection,
    LAMPORTS_PER_SOL,
    Transaction,
    TransactionInstruction,
    VersionedTransaction
} from '@solana/web3.js';
import {
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import * as bs58 from 'bs58';
import { HttpClient } from '@angular/common/http';
import { SolanaService } from '@shared/services/solana.service';
import BN from 'bn.js';
import { NotificationService } from './notification.service';
import { EventsService } from './events.service';

interface TradeQuote {
    amountOut: BN;
    minAmountOut: BN;
    fee: BN;
    priceImpact: number;
}

interface BondingCurveState {
    associated_bonding_curve: any,
    bonding_curve: any,
    virtualTokenReserves: BN;
    virtualSolReserves: BN;
    realTokenReserves: BN;
    realSolReserves: BN;
    tokenTotalSupply: BN;
    feeBasisPoints: number;
}

interface TransactionOptions {
    priorityFeeInSol?: number;
    jitoFeeInSol?: number;
}

@Injectable({
    providedIn: 'root'
})
export class PumpFunService {
    private readonly GLOBAL = new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
    private readonly FEE_RECIPIENT = new PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM");
    private readonly TOKEN_PROGRAM_ID1 = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    private readonly ASSOC_TOKEN_ACC_PROG = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
    private readonly RENT = new PublicKey("SysvarRent111111111111111111111111111111111");
    private readonly PUMP_FUN_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
    private readonly PUMP_FUN_ACCOUNT = new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1");
    private readonly TAX_WALLET = new PublicKey('CsKMxupdmfYpU74XXUHpG1WPKo9hRAPDidhNvNYe1x4T');
    private readonly DEFAULT_RETRY_COUNT = 1;

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

    private connection: Connection;
    private bondingCurveState: BondingCurveState | null = null;

    constructor(
        private http: HttpClient, 
        public solanaService: SolanaService, 
        public notificationService: NotificationService, 
        private eventsService: EventsService
    ) {
        this.connection = new Connection(
            'https://wandering-billowing-moon.solana-mainnet.quiknode.pro/da55f32e52d1b381b8dc20e71c097aa7d184cbe0', 
            'confirmed'
        );
    }

    /**
     * Convertit un nombre en Buffer représentant un UInt64
     */
    private bufferFromUInt64(value: number | bigint): Buffer {
        const buffer = Buffer.alloc(8);
        const bigIntValue = BigInt(value);

        for (let i = 0; i < 8; i++) {
            buffer[i] = Number((bigIntValue >> BigInt(i * 8)) & BigInt(255));
        }

        return buffer;
    }

    /**
     * Récupère les données d'une pièce depuis l'API
     */
    async getCoinData(mintStr: string): Promise<any | null> {
        try {
            const url = `https://souctnjaypcptqpeeuhh.supabase.co/functions/v1/coins?mint=${mintStr}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const dataLoad = await response.json();
            const data = dataLoad.data;
            
            if (!data.bonding_curve || !data.associated_bonding_curve) {
                console.error('Données incomplètes reçues de l\'API');
                return null;
            }

            return data;
        } catch (error) {
            console.error('Erreur lors de la récupération des données de la pièce:', error);
            return null;
        }
    }

    /**
     * Crée une transaction avec des instructions et options
     */
    private async createTransaction(
        instructions: TransactionInstruction[],
        payer: PublicKey,
        options: TransactionOptions = {}
    ): Promise<Transaction> {
        // Définir les unités de calcul
        const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ 
            units: 1400000 
        });
        const transaction = new Transaction().add(modifyComputeUnits);
    
        // Ajouter les frais de priorité Solana si spécifiés
        if (options.priorityFeeInSol && options.priorityFeeInSol > 0) {
            const microLamports = Math.floor(options.priorityFeeInSol * 1_000_000_000);
            const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ 
                microLamports 
            });
            transaction.add(addPriorityFee);
        }
    
        // Ajouter les instructions principales
        transaction.add(...instructions);
        transaction.feePayer = payer;
    
        // Ajouter les frais Jito si spécifiés
        if (options.jitoFeeInSol && options.jitoFeeInSol > 0) {
            const jito_validator_wallet = await this.getRandomValidator();
            const jitoFee = Math.floor(options.jitoFeeInSol * LAMPORTS_PER_SOL);
            const jitoFeeInstruction = SystemProgram.transfer({
                fromPubkey: payer,
                toPubkey: jito_validator_wallet,
                lamports: jitoFee,
            });
            transaction.add(jitoFeeInstruction);
        }
    
        // Ajouter le blockhash récent
        const recentBlockhash = await this.connection.getRecentBlockhash();
        transaction.recentBlockhash = recentBlockhash.blockhash;
    
        return transaction;
    }

    private async getRandomValidator(): Promise<PublicKey> {
        const res = this.jito_Validators[Math.floor(Math.random() * this.jito_Validators.length)];
        return new PublicKey(res);
    }

    /**
     * Initialise l'état de la courbe de bonding
     */
    async initializeBondingCurve(curve: any) {
        try {
            this.bondingCurveState = {
                associated_bonding_curve: curve.associated_bonding_curve,
                bonding_curve: curve.bonding_curve,
                virtualTokenReserves: new BN(curve.virtualTokenReserves),
                virtualSolReserves: new BN(curve.virtualSolReserves),
                realTokenReserves: new BN(curve.realTokenReserves),
                realSolReserves: new BN(curve.realSolReserves),
                tokenTotalSupply: new BN(curve.tokenTotalSupply),
                feeBasisPoints: 30
            };
        } catch (error) {
            console.error('Error initializing bonding curve:', error);
            throw error;
        }
    }

    /**
     * Calcule un devis d'achat (combien de tokens pour une quantité de SOL)
     * sans appliquer de slippage
     */
    async getBuyQuote(solAmountInLamports: BN): Promise<TradeQuote | null> {
        try {
            if (!this.bondingCurveState) {
                throw new Error('Bonding curve not initialized');
            }

            const {
                virtualTokenReserves,
                virtualSolReserves,
                realTokenReserves,
                feeBasisPoints
            } = this.bondingCurveState;

            if (virtualTokenReserves.isZero() || virtualSolReserves.isZero()) {
                throw new Error('Virtual reserves cannot be zero');
            }

            // Calcul du k constant (x * y = k)
            const k = virtualSolReserves.mul(virtualTokenReserves);

            // Nouveaux soldes virtuels après l'achat
            const newVirtualSolReserves = virtualSolReserves.add(solAmountInLamports);

            // Calcul des tokens en sortie de base
            let tokensOut;
            try {
                const divResult = k.div(newVirtualSolReserves);
                tokensOut = virtualTokenReserves.sub(divResult);
            } catch (e) {
                console.error('Error in token calculation:', e);
                tokensOut = new BN(0);
            }

            // Limiter aux réserves réelles disponibles
            const finalTokensOut = BN.min(tokensOut, realTokenReserves);

            // Calcul des frais
            const fee = solAmountInLamports.mul(new BN(feeBasisPoints)).div(new BN(10000));

            // Calculer l'impact sur le prix
            let priceImpact = 0;
            try {
                const spotPrice = virtualSolReserves.div(virtualTokenReserves);
                const executionPrice = solAmountInLamports.mul(new BN(1e9)).div(finalTokensOut);
                const spotPriceNum = spotPrice.toNumber();
                const executionPriceNum = executionPrice.toNumber();
                priceImpact = Math.abs((executionPriceNum - spotPriceNum) / spotPriceNum * 100);
            } catch (e) {
                console.error('Error calculating price impact:', e);
                priceImpact = 0;
            }

            return {
                amountOut: finalTokensOut,
                minAmountOut: finalTokensOut, // Sans slippage ici
                fee,
                priceImpact
            };
        } catch (error) {
            console.error('Error in getBuyQuote:', error);
            throw error;
        }
    }

    /**
     * Calcule la taxe à appliquer en fonction du montant
     */
    private calculateTax(amount: number, percentage: number = 0.003, minTax: number = 0.001): number {
        const calculatedTax = amount * percentage;
        return Math.max(calculatedTax, minTax);
    }

    /**
     * Estime le changement de solde après un achat
     */
    private estimateBalanceChangeForBuy(solIn: number, priorityFeeInSol: number, taxAmount: number): number {
        const totalCost = solIn + priorityFeeInSol + taxAmount + 0.00001; // Ajout d'un petit tampon pour les frais de réseau
        return -totalCost; // Négatif car c'est une dépense
    }

    /**
     * Estime le changement de solde après une vente
     */
    private estimateBalanceChangeForSell(solOut: BN, priorityFeeInSol: number, taxAmount: number): number {
        const netSolOut = solOut.toNumber() / LAMPORTS_PER_SOL;
        const totalCost = priorityFeeInSol + taxAmount + 0.00001; // Ajout d'un petit tampon pour les frais de réseau
        return netSolOut - totalCost; // Le solde net après vente et frais
    }

    /**
     * Effectue un achat avec retentatives en cas d'erreur de slippage
     */
    public async pumpFunBuyWithRetry(
        mintStr: string,
        solIn: number,
        priorityFeeInSol: number,
        slippageDecimal: number,
        gazFee: number,
        maxRetries: number = this.DEFAULT_RETRY_COUNT
    ) {
        let retryCount = 0;
        let lastError;
        let currentSlippage = slippageDecimal;

        // Capturer le solde initial pour l'estimation
        const initialBalance = this.solanaService.getCurrentBalance();

        while (retryCount <= maxRetries) {
            try {
                // Calculer la taxe
                const finalTax = this.calculateTax(solIn);
                
                // Estimer et mettre à jour le solde immédiatement
                // const balanceChange = this.estimateBalanceChangeForBuy(solIn, priorityFeeInSol, finalTax);
                // this.solanaService.updateWalletBalance(initialBalance + balanceChange);
                
                // Exécuter l'achat avec le slippage actuel
                const result = await this.pumpFunBuy(
                    mintStr,
                    solIn,
                    priorityFeeInSol,
                    currentSlippage,
                    gazFee
                );
                
                if (result.confirmed) {
                    // Transaction réussie, actualiser le solde réel
                    await this.solanaService.forceBalanceRefresh();
                    return result;
                }
                
                retryCount++;
            } catch (error:any) {
                lastError = error;
                console.error('Buy error:', error);
                
                // Vérifier si c'est une erreur de slippage
                const errorStr = error.toString().toLowerCase();
                if (errorStr.includes('slippage') || errorStr.includes('0x1771')) {
                    this.notificationService.showWarning('Slippage error detected, retrying with higher tolerance...');
                    
                    if (retryCount < maxRetries) {
                        // Augmenter le slippage et réessayer
                        currentSlippage = Math.min(currentSlippage + 0.01, 0.1); // +1% mais max 10%
                        retryCount++;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else {
                        // Plus de tentatives
                        this.notificationService.showError('Transaction failed after retry');
                        // Restaurer l'affichage du solde initial
                        this.solanaService.updateWalletBalance(initialBalance);
                        break;
                    }
                } else {
                    // Autre type d'erreur, ne pas réessayer
                    this.notificationService.showError('Transaction failed: ' + error.message);
                    // Restaurer l'affichage du solde initial
                    this.solanaService.updateWalletBalance(initialBalance);
                    break;
                }
            }
        }

        throw lastError || new Error('Transaction failed after multiple attempts');
    }

    /**
     * Exécute un achat sur PumpFun
     */
    public async pumpFunBuy(
        mintStr: string,
        solIn: number,
        priorityFeeInSol: number,
        slippageDecimal: number,
        gazFee: number
    ) {
        try {
            if (!this.solanaService.wallet?.publicKey) {
                this.notificationService.showError('Not connected.');
                throw new Error('Wallet not connect');
            }

            const owner = this.solanaService.wallet?.publicKey;
            const mint = new PublicKey(mintStr);

            // Calculer la taxe
            const taxPercentage = 0.003;
            const calculatedTax = solIn * taxPercentage;
            const minTax = 0.001;
            const finalTax = Math.max(calculatedTax, minTax);

            // Montant SOL ajusté après taxe
            const adjustedSolIn = solIn;
            const solInBN = new BN(Math.floor(adjustedSolIn * LAMPORTS_PER_SOL));

            // Obtenir le quote SANS slippage
            const quote = await this.getBuyQuote(solInBN);

            if (!quote) {
                this.notificationService.showError('Error price loading');
                throw new Error('Failed to get quote');
            }

            const instructions: TransactionInstruction[] = [];

            // Vérifier et créer le compte de token si nécessaire
            const tokenAccountAddress = await getAssociatedTokenAddress(mint, owner, false);
            const tokenAccountInfo = await this.connection.getAccountInfo(tokenAccountAddress);
            
            if (!tokenAccountInfo) {
                instructions.push(
                    createAssociatedTokenAccountInstruction(
                        owner,
                        tokenAccountAddress,
                        owner,
                        mint
                    )
                );
            }

            // Calculer le montant minimum de tokens avec slippage
            const slippageMultiplier = new BN(10000 - Math.floor(slippageDecimal * 10000));
            const minTokensOut = quote.amountOut

            const maxSolAmount = quote.amountOut.mul(slippageMultiplier).div(new BN(10000));

            // Créer l'instruction d'achat avec slippage appliqué ici
            const data = Buffer.concat([
                this.bufferFromUInt64(16927863322537952870n), // Discriminator
                this.bufferFromUInt64(BigInt(minTokensOut.toString())), // Montant minimal à recevoir (avec slippage)
                this.bufferFromUInt64(BigInt(maxSolAmount.toString())) // Maximum SOL à payer avec marge
            ]);

            const coinData: any = this.bondingCurveState;
            const keys = [
                { pubkey: this.GLOBAL, isSigner: false, isWritable: false },
                { pubkey: this.FEE_RECIPIENT, isSigner: false, isWritable: true },
                { pubkey: mint, isSigner: false, isWritable: false },
                { pubkey: new PublicKey(coinData.bonding_curve), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(coinData.associated_bonding_curve), isSigner: false, isWritable: true },
                { pubkey: tokenAccountAddress, isSigner: false, isWritable: true },
                { pubkey: owner, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: this.RENT, isSigner: false, isWritable: false },
                { pubkey: this.PUMP_FUN_ACCOUNT, isSigner: false, isWritable: false },
                { pubkey: this.PUMP_FUN_PROGRAM, isSigner: false, isWritable: false }
            ];

            const buyInstruction = new TransactionInstruction({
                keys,
                programId: this.PUMP_FUN_PROGRAM,
                data
            });

            instructions.push(buyInstruction);

            // Ajouter l'instruction de taxe
            const taxInstruction = SystemProgram.transfer({
                fromPubkey: owner,
                toPubkey: this.TAX_WALLET,
                lamports: Math.floor(finalTax * LAMPORTS_PER_SOL)
            });
            instructions.push(taxInstruction);

            // Créer la transaction
            const transaction = await this.createTransaction(instructions, owner, {
                priorityFeeInSol: gazFee,
                jitoFeeInSol: priorityFeeInSol
            });

            // Obtenir un nouveau blockhash
            const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.lastValidBlockHeight = lastValidBlockHeight;

            // Signer la transaction
            const signedTransaction = await this.solanaService.wallet.signTransaction(transaction);

            // Vérifier que la transaction est bien signée
            if (!signedTransaction.signatures || signedTransaction.signatures.length === 0) {
                this.notificationService.showError('Transaction signing failed');
                throw new Error('Transaction signing failed');
            }

            // Exécuter la transaction signée
            return await this.jito_executeAndConfirm(signedTransaction);
        } catch (error) {
            console.error('Error in pumpFunBuy:', error);
            throw error;
        }
    }

    /**
     * Exécute une transaction via Jito et attend sa confirmation
     */
    private async jito_executeAndConfirm(transaction: VersionedTransaction) {
        try {
            // S'assurer que la transaction est complètement signée avant la sérialisation
            if (!transaction.signatures || transaction.signatures.length === 0) {
                throw new Error('Transaction not signed');
            }
    
            // Sérialiser la transaction
            const serializedTransaction = transaction.serialize();
    
            const requests = this.endpoints.map((url) =>
                fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        id: 1,
                        method: "sendBundle",
                        params: [[bs58.encode(serializedTransaction)]],
                    })
                })
            );
    
            const res = await Promise.all(requests.map((p) => p.catch((e) => e)));
            const success_res = res.filter((r) => !(r instanceof Error));
    
            if (success_res.length > 0) {
                // Extraire la signature correctement
                const bs: any = transaction.signatures[0];
                const signature = bs58.encode(bs.signature);
                const latestBlockhash = await this.connection.getLatestBlockhash();
                return await this.jito_confirm(signature, latestBlockhash);
            }
    
            this.notificationService.showError('Transaction failed');
            return { confirmed: false, signature: null };
        } catch (e) {
            this.notificationService.showError('Transaction failed');
            console.error('Error in jito_executeAndConfirm:', e);
            return { confirmed: false, signature: null };
        }
    }
    
    /**
     * Attend la confirmation d'une transaction
     */
    private async jito_confirm(signature: string, latestBlockhash: any) {
        try {
            // Déclencher une actualisation du solde en arrière-plan après un court délai
            setTimeout(() => this.solanaService.forceBalanceRefresh(), 3000);
            
            // Lancer la surveillance de finalisation en arrière-plan
            this.watchTransactionStatus(signature);
            
            // Retourner immédiatement après soumission
            return { confirmed: true, signature };
    
        } catch (e) {
            this.notificationService.showError('Transaction failed. Please try again.');
            return { confirmed: false, signature };
        }
    }
    
    // Nouvelle méthode pour surveiller le statut en arrière-plan
    private watchTransactionStatus(signature: string) {
        let statusNotified = false;
        
        const checkStatus = async () => {
            try {
                const response = await this.connection.getSignatureStatus(signature);
                
                if (response?.value) {
                    if (response.value.confirmationStatus === "confirmed" && !statusNotified) {
                        statusNotified = true;
                        this.notificationService.showSuccess('Transaction successfully completed! 🎉');
                        await this.solanaService.forceBalanceRefresh();
                        this.eventsService.emitTransactionFinalized(signature);
                    }
                }
                
                // Continuer à vérifier si pas encore confirmé
                if (!statusNotified) {
                    setTimeout(checkStatus, 2000);
                }
            } catch (error) {
                console.error("Error checking transaction status:", error);
            }
        };
        
        // Démarrer la vérification
        setTimeout(checkStatus, 1000);
    }
    
    
    /**
     * Calcule un devis de vente (combien de SOL pour une quantité de tokens)
     * sans appliquer de slippage
     */
    async getSellQuote(tokenAmountIn: BN): Promise<TradeQuote | null> {
        try {
            if (!this.bondingCurveState) {
                throw new Error('Bonding curve not initialized');
            }
    
            const {
                virtualTokenReserves,
                virtualSolReserves,
                realTokenReserves,
                feeBasisPoints
            } = this.bondingCurveState;
    
            if (virtualTokenReserves.isZero() || virtualSolReserves.isZero()) {
                throw new Error('Virtual reserves cannot be zero');
            }
    
            // Calculer le montant de SOL en sortie
            const baseSolOut = tokenAmountIn.mul(virtualSolReserves).div(virtualTokenReserves.add(tokenAmountIn));
    
            // Calculer les frais
            const fee = baseSolOut.mul(new BN(feeBasisPoints)).div(new BN(10000));
    
            // Soustraire les frais du montant de base
            const netSolOut = baseSolOut.sub(fee);
    
            // Calculer l'impact sur le prix
            let priceImpact = 0;
            try {
                const spotPrice = virtualSolReserves.div(virtualTokenReserves);
                const executionPrice = netSolOut.mul(new BN(1e9)).div(tokenAmountIn);
                const spotPriceNum = spotPrice.toNumber();
                const executionPriceNum = executionPrice.toNumber();
                priceImpact = Math.abs((executionPriceNum - spotPriceNum) / spotPriceNum * 100);
            } catch (e) {
                console.error('Error calculating price impact:', e);
                priceImpact = 0;
            }
    
            return {
                amountOut: netSolOut,
                minAmountOut: netSolOut, // Sans slippage ici
                fee,
                priceImpact
            };
    
        } catch (error) {
            console.error('Error in getSellQuote:', error);
            throw error;
        }
    }
    
    /**
     * Effectue une vente avec retentatives en cas d'erreur de slippage
     */
    public async pumpFunSellWithRetry(
        mintStr: string,
        amountToSell: any,
        priorityFeeInSol: number,
        slippageDecimal: number,
        gazFee: number,
        maxRetries: number = this.DEFAULT_RETRY_COUNT
    ) {
        let retryCount = 0;
        let lastError;
        let currentSlippage = slippageDecimal;

        // Capturer le solde initial pour l'estimation
        const initialBalance = this.solanaService.getCurrentBalance();

        while (retryCount <= maxRetries) {
            try {
                // Pour estimer le changement de solde, nous avons besoin du quote
                const amountToSellBN = new BN(amountToSell);
                const quote = await this.getSellQuote(amountToSellBN);
                
                if (!quote) {
                    throw new Error('Failed to get quote for balance estimation');
                }
                
                // Calculer la taxe
                const taxPercentage = 0.001;
                const calculatedTax = Math.floor(quote.amountOut.toNumber() / LAMPORTS_PER_SOL * taxPercentage);
                const minTax = 0.001;
                const finalTax = Math.max(calculatedTax, minTax);
            
                // Exécuter la vente avec le slippage actuel
                const result = await this.pumpFunSell(
                    mintStr,
                    amountToSell,
                    priorityFeeInSol,
                    currentSlippage,
                    gazFee
                );
                
                if (result.confirmed) {
                    // Transaction réussie, actualiser le solde réel
                    await this.solanaService.forceBalanceRefresh();
                    return result;
                }
                
                retryCount++;
            } catch (error:any) {
                lastError = error;
                console.error('Sell error:', error);
                
                // Vérifier si c'est une erreur de slippage
                const errorStr = error.toString().toLowerCase();
                if (errorStr.includes('slippage') || errorStr.includes('0x1771')) {
                    this.notificationService.showWarning('Slippage error detected, retrying with higher tolerance...');
                    
                    if (retryCount < maxRetries) {
                        // Augmenter le slippage et réessayer
                        currentSlippage = Math.min(currentSlippage + 0.01, 0.1); // +1% mais max 10%
                        retryCount++;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else {
                        // Plus de tentatives
                        this.notificationService.showError('Transaction failed after retry');
                        // Restaurer l'affichage du solde initial
                        this.solanaService.updateWalletBalance(initialBalance);
                        break;
                    }
                } else {
                    // Autre type d'erreur, ne pas réessayer
                    this.notificationService.showError('Transaction failed: ' + error.message);
                    // Restaurer l'affichage du solde initial
                    this.solanaService.updateWalletBalance(initialBalance);
                    break;
                }
            }
        }

        throw lastError || new Error('Transaction failed after multiple attempts');
    }
    
    /**
     * Exécute une vente sur PumpFun
     */
    public async pumpFunSell(
        mintStr: string,
        amountToSell: any,
        priorityFeeInSol: number,
        slippageDecimal: number,
        gazFee: number
    ) {
        try {
            if (!this.solanaService.wallet?.publicKey) {
                this.notificationService.showError('Not connected.');
                throw new Error('Wallet not connected');
            }

            const owner = this.solanaService.wallet.publicKey;
            const mint = new PublicKey(mintStr);

            // Obtenir le solde de tokens
            const tokenAccountAddress = await getAssociatedTokenAddress(mint, owner, false);
            const tokenAccountInfo: any = await this.connection.getParsedAccountInfo(tokenAccountAddress);

            if (!tokenAccountInfo.value) {
                this.notificationService.showError('Token account not found');
                throw new Error('Token account not found');
            }

            const tokenAmount = tokenAccountInfo.value.data.parsed.info.tokenAmount.amount;
            if (tokenAmount === '0') {
                this.notificationService.showError('No tokens available to sell');
                throw new Error('No tokens available to sell');
            }

            // Convertir le montant à vendre en BN
            amountToSell = new BN(amountToSell);
            
            // Obtenir le quote SANS slippage
            const quote = await this.getSellQuote(amountToSell);

            if (!quote) {
                this.notificationService.showError('Error price loading');
                throw new Error('Failed to get quote');
            }

            // Calculer la taxe
            const taxPercentage = 0.001; // 0.1%
            const calculatedTax = Math.floor(quote.amountOut.toNumber() * taxPercentage / LAMPORTS_PER_SOL);
            const minTax = 0.001 * LAMPORTS_PER_SOL; // 0.001 SOL minimum
            const finalTax = Math.max(calculatedTax, minTax);

            // Appliquer le slippage pour le montant minimum de SOL à recevoir
            const slippageMultiplier = new BN(10000 - Math.floor(slippageDecimal * 10000));
            const minSolOut = quote.amountOut.mul(slippageMultiplier).div(new BN(10000));

            // Ajuster le montant minimum en SOL en tenant compte de la taxe
            const adjustedMinSolOut = minSolOut.sub(new BN(finalTax));

            // Créer l'instruction de vente avec slippage appliqué ici
            const data = Buffer.concat([
                this.bufferFromUInt64(12502976635542562355n), // Discriminator pour sell
                this.bufferFromUInt64(BigInt(amountToSell.toString())),
                this.bufferFromUInt64(BigInt(adjustedMinSolOut.toString())) // Montant minimum après slippage et taxes
            ]);

            const coinData: any = this.bondingCurveState;
            const keys = [
                { pubkey: this.GLOBAL, isSigner: false, isWritable: false },
                { pubkey: this.FEE_RECIPIENT, isSigner: false, isWritable: true },
                { pubkey: mint, isSigner: false, isWritable: false },
                { pubkey: new PublicKey(coinData.bonding_curve), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(coinData.associated_bonding_curve), isSigner: false, isWritable: true },
                { pubkey: tokenAccountAddress, isSigner: false, isWritable: true },
                { pubkey: owner, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: this.ASSOC_TOKEN_ACC_PROG, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: this.PUMP_FUN_ACCOUNT, isSigner: false, isWritable: false },
                { pubkey: this.PUMP_FUN_PROGRAM, isSigner: false, isWritable: false }
            ];

            const instructions: TransactionInstruction[] = [];

            // Instruction de vente
            const sellInstruction = new TransactionInstruction({
                keys,
                programId: this.PUMP_FUN_PROGRAM,
                data
            });
            instructions.push(sellInstruction);

            // Ajouter l'instruction de taxe
            const taxInstruction = SystemProgram.transfer({
                fromPubkey: owner,
                toPubkey: this.TAX_WALLET,
                lamports: finalTax
            });
            instructions.push(taxInstruction);

            // Créer la transaction
            const transaction = await this.createTransaction(
                instructions,
                owner,
                {
                    priorityFeeInSol: gazFee,
                    jitoFeeInSol: priorityFeeInSol
                }
            );

            // Obtenir un nouveau blockhash
            const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.lastValidBlockHeight = lastValidBlockHeight;

            // Signer la transaction
            const signedTransaction = await this.solanaService.wallet.signTransaction(transaction);

            if (!signedTransaction.signatures || signedTransaction.signatures.length === 0) {
                this.notificationService.showError('Transaction signing failed');
                throw new Error('Transaction signing failed');
            }

            // Exécuter la transaction
            return await this.jito_executeAndConfirm(signedTransaction);
        } catch (error) {
            console.error('Error in pumpFunSell:', error);
            throw error;
        }
    }
}
