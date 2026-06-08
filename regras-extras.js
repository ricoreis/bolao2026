/**
 * REGRAS-EXTRAS.JS
 * Motor dinâmico de apostas extras e punições.
 * 
 * Como usar:
 * Passar a sigla correspondente à regra (ex: 'CAMP16') 
 * e o array de regras vindo do Supabase.
 */

export const RegrasExtras = {
    
    /**
     * Busca o valor de uma pontuação específica no banco de dados.
     * @param {string} sigla - O identificador (nome_reduzido) no banco.
     * @param {Array} tabelaRegras - O array completo vindo da tabela 'pontuacao'.
     * @returns {number} - O valor da pontuação (ou 0 se não encontrar).
     */
    obterPontos: (sigla, tabelaRegras) => {
        const regra = tabelaRegras.find(r => r.nome_reduzido === sigla);
        return regra ? regra.pontos : 0;
    },

    /**
     * Valida se um palpite de Campeão deve sofrer punição.
     * @param {string} sigla - A sigla da punição aplicada (ex: 'CAMP8').
     * @param {Array} tabelaRegras - O array completo vindo da tabela 'pontuacao'.
     * @returns {number} - O valor negativo da punição.
     */
    aplicarPunicaoCampeao: (sigla, tabelaRegras) => {
        // Busca a regra pelo código oficial do banco
        const regra = tabelaRegras.find(r => r.nome_reduzido === sigla);
        
        // Retorna o valor (que já deve estar negativo no banco)
        return regra ? regra.pontos : 0;
    }
};