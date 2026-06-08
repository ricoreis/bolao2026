/**
 * regras-extras.js
 * Lógica de cálculo para palpites de longo prazo (Extras).
 */

export const RegrasExtras = {
    
    // Calcula pontos do Duelo de Gigantes (CR7/Messi)
    // palpite: 'CR7' ou 'MESSI' | gabarito: 'CR7' ou 'MESSI'
    calcularDueloGigantes: (palpite, gabarito, pontosBase) => {
        return (palpite === gabarito) ? pontosBase : 0;
    },

    // Calcula pontos do Total de Gols (ALLGOLS) com margem de erro
    // palpite: int | gabarito: int
    calcularTotalGols: (palpite, gabarito, pontosBase) => {
        const diferenca = Math.abs(palpite - gabarito);

        if (diferenca === 0) return pontosBase;           // Acerto exato
        if (diferenca <= 5)  return Math.floor(pontosBase * 0.7); // Margem 5
        if (diferenca <= 10) return Math.floor(pontosBase * 0.4); // Margem 10
        if (diferenca <= 20) return Math.floor(pontosBase * 0.2); // Margem 20
        
        return 0; // Muito longe
    },

    // Função genérica para buscar pontuação de qualquer categoria
    obterPontos: (nomeReduzido, configRegras) => {
        const regra = configRegras.find(r => r.nome_reduzido === nomeReduzido);
        return regra ? regra.pontos : 0;
    }
};