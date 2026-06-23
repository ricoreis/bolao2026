import { RegrasExtras } from './regras-extras.js';
import { supabaseClient } from './supabase-config.js';
import { carregarSaudacao } from './auth-header.js';

document.addEventListener('DOMContentLoaded', carregarRanking);
const btnsLogout = document.querySelectorAll('.btn-logout');

const DB_CONFIG = {
    RESULTADOS: 'resultados_teste',
    GRUPOS: 'grupos',
    PAISES: 'paises',
    JOGADORES: 'jogadores',
    FASES: 'fases',
    APOSTAS: 'apostas',
    PONTUACAO: 'pontuacao',
	JOGOS: 'jogos',
	USUARIOS: 'usuarios',
	PALPITES: 'palpites'
};

async function carregarRanking() {
    const loader = document.getElementById('loader');
    const tabelaWrapper = document.getElementById('tabela-wrapper');

    try {
        // Criamos o tempo mínimo de 3 segundos
        const tempoMinimo = new Promise(resolve => setTimeout(resolve, 3000));

        // Iniciamos o carregamento dos dados E o timer em paralelo
        const [
            apostasTemporarias, 
            { data: headers },
            { data: jogos },
            { data: usuarios }
        ] = await Promise.all([
            carregarTodasAsApostas(),
            supabaseClient.from(DB_CONFIG.PONTUACAO).select('*').order('id'),
            supabaseClient.from(DB_CONFIG.JOGOS).select('*, vencedor_final_id'),
            supabaseClient.from(DB_CONFIG.USUARIOS).select('*'),
            tempoMinimo // <-- O segredo: o Promise.all só termina quando o mais lento acabar
        ]);

        const apostas = apostasTemporarias;

        await processarParticipantes(usuarios);
        const rankingFinal = await processarRanking(apostas, jogos, headers);
        
        renderizarTabela(rankingFinal, headers);

        if (loader) loader.classList.add('hidden');
        if (tabelaWrapper) tabelaWrapper.classList.remove('hidden');

    } catch (error) {
        console.error("Erro ao carregar ranking:", error);
        
        if (loader) {
            loader.innerHTML = `
                <div class="text-center p-6">
                    <iconify-icon class="text-5xl text-red-500" icon="material-symbols:error-outline"></iconify-icon>
                    <p class="text-red-400 mt-4">Erro ao carregar ranking.</p>
                    <button onclick="window.location.reload()" class="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg text-sm">Tentar novamente</button>
                </div>
            `;
        }
    }
}

async function processarGrupos(usuarioId, regras, totalGrupos) {
    const { data: gabaritos } = await supabaseClient.from(DB_CONFIG.GRUPOS).select('*');
    const { data: palpiteDB } = await supabaseClient.from(DB_CONFIG.PALPITES).select('palpites_grupos').eq('usuario_id', usuarioId);

    if (!gabaritos || !palpiteDB || palpiteDB.length === 0) return { total: 0, contagem: {1:0, 2:0, 3:0, 4:0, ALL1: 0, ALL2: 0, ALL3: 0, ALL4: 0, ALLG: 0} };

    const palpites = palpiteDB[0].palpites_grupos;
    let pontosGrupo = 0;
    const contagem = { 1: 0, 2: 0, 3: 0, 4: 0, ALL1: 0, ALL2: 0, ALL3: 0, ALL4: 0, ALLG: 0 };
    let gruposPerfeitos = 0;

    gabaritos.forEach(g => {
        if (!g.classificacao) return;
        const gab = typeof g.classificacao === 'string' ? JSON.parse(g.classificacao) : g.classificacao;
        const palpiteGrupo = palpites[g.grupo] || {};
        let acertosNoGrupo = 0;

        Object.entries(gab).forEach(([pais, posicaoReal]) => {
            const posicaoPalpite = palpiteGrupo[pais];
            if (posicaoPalpite !== undefined && posicaoReal === posicaoPalpite) {
                acertosNoGrupo++;
                if (contagem.hasOwnProperty(posicaoPalpite)) contagem[posicaoPalpite]++;
                const regra = regras.find(r => r.nome_reduzido === `${posicaoPalpite}ºGRP`);
                if (regra) pontosGrupo += parseInt(regra.pontos || 0);
            }
        });
        if (acertosNoGrupo === 4) {
            gruposPerfeitos++;
            contagem.ALLG++;
        }
    });

    [1, 2, 3, 4].forEach(pos => {
        if (contagem[pos] === totalGrupos) {
            contagem['ALL' + pos] = 1;
            const regra = regras.find(r => r.nome_reduzido === `ALL${pos}º`);
            if (regra) pontosGrupo += parseInt(regra.pontos || 0);
        }
    });

    const regraAllGrp = regras.find(r => r.nome_reduzido === 'ALLGRP');
    if (regraAllGrp) pontosGrupo += (gruposPerfeitos * parseInt(regraAllGrp.pontos || 0));

    return { total: pontosGrupo, contagem: contagem };
}

async function processarParticipantes(usuarios) {

    const container = document.getElementById('container-participantes');
    const template = document.getElementById('template-participante');
    if (!container || !template) return;
    container.innerHTML = ''; 
    // console.log(usuarios);

    usuarios.forEach(usuario => {

        // console.log("Participante: " + usuario.nome);
        const card = template.content.cloneNode(true);
        const cardElement = card.querySelector('.participante');
        card.querySelector('.participante-nome').innerText = usuario.nome;

        container.appendChild(card);

    });

}

async function processarRanking(apostas, jogos, headers) {

    const rankingMap = {};

    const { data: todosUsuarios } = await supabaseClient.from(DB_CONFIG.USUARIOS).select('*');
    // 1. Inicializa o map com TODOS os usuários (os 33)
    todosUsuarios.forEach(u => {
        const usuarioObj = { 
            usuario_id: u.id, 
            nome: u.nome, 
            pontos_totais: 0,
            acertos_exatos: 0,
            acertos_saldo: 0,
            acertos_vencedor: 0,
            acertos_empate: 0,
            acertos_gols: 0,
            acertos_exato_neg: 0,
            acertos_saldo_neg: 0,
            acertos_venc_neg: 0
        };
        headers.forEach(h => usuarioObj[h.coluna_db] = 0);
        usuarioObj['placar_classificado_penaltis'] = 0;
        rankingMap[u.id] = usuarioObj;
    });

    // 2. Agora processa as apostas apenas para somar pontos aos que já existem
    // jogos.forEach(jogo => {
    //     if (jogo.gols_a === null || jogo.gols_b === null) return;
    //     apostas.forEach(aposta => {
    //         if (String(aposta.jogo_id) === String(jogo.id)) {
    //             const usr = rankingMap[aposta.usuario_id];
    //             if (!usr) return;
                
    //             let mult = (parseInt(jogo.id) > 72) ? 2 : 1;
    //             const res = calcularPontos(aposta.gols_a, aposta.gols_b, jogo.gols_a, jogo.gols_b, headers, mult);
                
    //             if (res.total > 0 || res.coluna) {
    //                 usr.pontos_totais += parseInt(res.total);
    //             }
    //         }
    //     });
    // });

    const [
        { data: gabaritoBruto }, { data: paises }, { data: jogadores }, { data: fases }, { data: grupos },
    ] = await Promise.all([
        supabaseClient.from(DB_CONFIG.RESULTADOS).select('*').single(),
        supabaseClient.from(DB_CONFIG.PAISES).select('*'),
        supabaseClient.from(DB_CONFIG.JOGADORES).select('*'),
        supabaseClient.from(DB_CONFIG.FASES).select('*'),
        supabaseClient.from(DB_CONFIG.GRUPOS).select('*')
    ]);

    const gabaritoFinal = sanitizarResultadoFinal(gabaritoBruto, jogos);

    const formatarValor = (tabela, id, tipo) => {
        if (id == null) return "Sem palpite";
        if (tipo === 'bruto') return id;
        const item = tabela?.find(i => parseInt(i.id) === parseInt(id));
        return item ? item.nome : `ID: ${id}`;
    };

    apostas.forEach(a => {
        if (!rankingMap[a.usuario_id]) {
            const usuarioObj = { usuario_id: a.usuario_id, nome: a.usuarios?.nome || 'Anon', pontos_totais: 0 };
            headers.forEach(h => usuarioObj[h.coluna_db] = 0);
            usuarioObj['placar_classificado_penaltis'] = 0;
            rankingMap[a.usuario_id] = usuarioObj;
        }
    });

    jogos.forEach(jogo => {
        // Essa é a cláusula de segurança, ela já existe aí!
        if (jogo.gols_a === null || jogo.gols_b === null) return;
        
        apostas.forEach(aposta => {
  
            // A Mudança para parseInt resolve a inconsistência de tipos
            if (parseInt(aposta.jogo_id) === parseInt(jogo.id)) {
                
                const usr = rankingMap[aposta.usuario_id];
                // Se o usuário não estiver no mapa, não tem como somar pontos
                if (!usr) return; 

                let mult = (parseInt(jogo.id) > 72) ? 2 : 1;
                const res = calcularPontos(aposta.gols_a, aposta.gols_b, jogo.gols_a, jogo.gols_b, headers, mult);
                // console.log(res);

                if (aposta.usuario_id === "874f9d4e-8583-4494-bfc4-4b981406426c") {
                    // console.log(`Jogo ${jogo.id} | ${usr.nome} | Aposta: ${aposta.gols_a}x${aposta.gols_b} (${jogo.gols_a}x${jogo.gols_b}) | Pts: ${res.total} | Exato: ${res.exato} | Saldo: ${res.saldo} | Venc: ${res.venc} | Empate: ${res.empate}`);
                }

                if (res.total > 0 || res.coluna) {
                    usr.pontos_totais += res.total;

                    // Positivos
                    if (res.exato) usr.acertos_exatos++;
                    if (res.saldo) usr.acertos_saldo++;
                    if (res.venc)  usr.acertos_vencedor++;
                    if (res.empate) usr.acertos_empate++;

                    // Novos critérios
                    if (res.bonus > 0) usr.acertos_gols = (usr.acertos_gols || 0) + res.bonus;
                    if (res.exatoNeg) usr.acertos_exato_neg++;
                    if (res.saldoNeg) usr.acertos_saldo_neg++;
                    if (res.vencNeg)  usr.acertos_venc_neg++;
                }
            }
        });
    });

    const usuarios = Object.values(rankingMap);

    let algumGrupoIndefinido = false;
    let gruposDefinidos = 0;

    grupos.forEach(g => {
        if (g.classificacao && typeof g.classificacao === 'object') {
            const valores = Object.values(g.classificacao);
            const temInvalido = valores.some(c => c === null || c === '');
            if (temInvalido) {
                algumGrupoIndefinido = true;
            } else {
                gruposDefinidos++;
            }
        }
    });

    await Promise.all(usuarios.map(async (usr) => {

        const resG = await processarGrupos(usr.usuario_id, headers, 12);

        const iconeS = `<iconify-icon icon="material-symbols:check-circle-rounded" class="text-emerald-300 text-lg"></iconify-icon>`; 
        const iconeN = `<iconify-icon icon="dashicons:no" class="text-gray-300/35 text-lg"></iconify-icon>`; 
        const iconeP = `<iconify-icon icon="mingcute:sandglass-line" class="text-gray-300/35 text-lg"></iconify-icon>`; 
        const iconeHifen = `<span class="text-gray-500 text-lg font-bold">-</span>`;

        usr.pontos_totais += resG.total;
        usr['grupo_primeiro'] = resG.contagem[1];
        usr['grupo_segundo'] = resG.contagem[2];
        usr['grupo_terceiro'] = resG.contagem[3];
        usr['grupo_quarto'] = resG.contagem[4];

        usr['grupo_todos_primeiros'] = gruposDefinidos - resG.contagem[1] > 0 ? iconeN : algumGrupoIndefinido ? iconeP : iconeS;
        usr['grupo_todos_segundos'] = gruposDefinidos - resG.contagem[2] > 0 ? iconeN : algumGrupoIndefinido ? iconeP : iconeS;
        usr['grupo_todos_terceiros'] = gruposDefinidos - resG.contagem[3] > 0 ? iconeN : algumGrupoIndefinido ? iconeP : iconeS;
        usr['grupo_todos_quartos'] = gruposDefinidos - resG.contagem[4] > 0 ? iconeN : algumGrupoIndefinido ? iconeP : iconeS;

        usr['grupo_todos_exatos'] = resG.contagem.ALLG;

        try {
            const { data: pList } = await supabaseClient.from(DB_CONFIG.PALPITES).select('*').eq('usuario_id', usr.usuario_id);

            // if (!pList || pList.length === 0) {
            //     console.log(`Usuário ${usr.nome} não tem palpites. Pulando lógica extra.`);
            //     return;
            // }
        
            const p = pList[0];
            // const p = (pList && pList.length > 0) ? pList[0] : null;

            // console.log(`DEBUG: Processando usuário ${usr.nome}, Palpite encontrado:`, !!p);
            if (p && gabaritoFinal) {

                // Lógica de Comparação
                const palpiteCamp = parseInt(p.campeao_id);
                const palpiteVice = parseInt(p.vice_id);
                const gabCamp = parseInt(gabaritoFinal.campeao_id);
                const gabVice = parseInt(gabaritoFinal.vice_id);

                // ---------------------------------------------------------------------------

                // TEMPORARIAMENTE FORA
                // --- LÓGICA DO PENAL (Simplificada e direto na fonte) ---
                // apostas.forEach(aposta => {
                //     const jogo = jogos.find(j => String(j.id) === String(aposta.jogo_id));
                //     const usr = rankingMap[aposta.usuario_id];
                    
                //     if (usr['placar_classificado_penaltis'] === undefined) {
                //         usr['placar_classificado_penaltis'] = 0;
                //     }
                    
                //     if (jogo && jogo.penaltis_vencedor_id && aposta.penaltis_vencedor_id) {
                //         const acertou = (parseInt(aposta.penaltis_vencedor_id) === parseInt(jogo.penaltis_vencedor_id));
                        
                //         if (acertou) {
                //             usr['placar_classificado_penaltis'] += 1;
                //             const regraPenal = headers.find(h => h.nome_reduzido === 'PENAL');
                //             if (regraPenal) usr.pontos_totais += parseInt(regraPenal.pontos || 0);
                //         }
                //     }
                // });

                // ---------------------------------------------------------------------------

                const acertou = (palpiteCamp === gabCamp && palpiteVice === gabVice);
                const nomeCamp = paises.find(pais => pais.id === palpiteCamp)?.nome || "??";
                const nomeVice = paises.find(pais => pais.id === palpiteVice)?.nome || "??";

                usr['final_copa'] = `${acertou ? 'S' : 'N'} (${nomeCamp} x ${nomeVice})`;

                if (acertou) {
                    const regra = headers.find(h => h.nome_reduzido === 'FINAL');
                    if (regra) {
                        usr.pontos_totais += parseInt(regra.pontos || 0);
                    } else {
                        console.warn("Regra 'FINAL_COMPLETA' não encontrada nos headers!");
                    }
                }

                // ----------------------------------------------------------------------
                
                // --- CAMPEAO CAINDO
                // --- TEMPORARIAMENTE FORA
                // const colunas = ["campeao_perde_grupos", "campeao_perde_16", "campeao_perde_8", "campeao_perde_4", "campeao_perde_3", "campeao_perde_final"];
                // colunas.forEach(c => usr[c] = '-'); 

                // const pCamp = parseInt(p.campeao_id);
                // const jogoFinal = jogos.find(j => parseInt(j.fase_id) === 7);
                // const vencedorOficial = jogoFinal ? parseInt(jogoFinal.vencedor_final_id) : null;

                // if (pCamp > 0 && vencedorOficial > 0 && vencedorOficial !== null) {

                //     const faseID = determinarFase(pCamp, jogos, fases);
                //     const colunas = ["campeao_perde_grupos", "campeao_perde_16", "campeao_perde_8", "campeao_perde_4", "campeao_perde_3", "campeao_perde_final"];
                //     colunas.forEach(c => usr[c] = 'N1');

                //     if (faseID === 1) usr["campeao_perde_grupos"] = 'S';
                //     else if (faseID === 2) usr["campeao_perde_16"] = 'S';
                //     else if (faseID === 3) usr["campeao_perde_8"] = 'S';
                //     else if (faseID === 4) usr["campeao_perde_4"] = 'S';
                //     else if (faseID === 5) usr["campeao_perde_3"] = 'S';
                //     else if (faseID === 6) usr["campeao_perde_3"] = 'S';
                //     else if (faseID === 7) {
                //         if (vencedorOficial !== null && pCamp !== vencedorOficial) {
                //             usr["campeao_perde_final"] = 'S';
                //         } else {
                //             usr["campeao_perde_final"] = 'N';
                //         }
                //     }

                //     const mapaRegras = [
                //         { c: "campeao_perde_grupos", r: "CAMPGR" },
                //         { c: "campeao_perde_16", r: "CAMP16" },
                //         { c: "campeao_perde_8", r: "CAMP8" },
                //         { c: "campeao_perde_4", r: "CAMP4" },
                //         { c: "campeao_perde_3", r: "CAMP3" },
                //         { c: "campeao_perde_final", r: "CAMPVICE" }
                //     ];

                //     mapaRegras.forEach(m => {
                //         if (usr[m.c] === 'S') {
                //             const regraObj = headers.find(h => h.nome_reduzido === m.r);
                //             if (regraObj && regraObj.pontos) {
                //                 usr.pontos_totais += parseInt(regraObj.pontos);
                //             }
                //         }
                //     });
                // }

                // ----------------------------------------------------------------------

                // --- GOLS
                // --- TEMPORARIAMENTE FORA
                // const apostasDoUsuario = apostas.filter(a => String(a.usuario_id) === String(usr.usuario_id));
                // const palpiteGols = apostasDoUsuario.reduce((soma, a) => soma + (a.gols_a || 0) + (a.gols_b || 0), 0);

                // const gabGols = jogos
                //     .filter(j => j.gols_a !== null && j.gols_b !== null)
                //     .reduce((soma, j) => soma + j.gols_a + j.gols_b, 0);

                // if (gabGols > 0) {
                //     const dif = Math.abs(palpiteGols - gabGols);
                //     const regraAllGols = headers.find(h => h.nome_reduzido === 'ALLGOLS');
                    
                //     const pontosBonus = regraAllGols ? parseInt(regraAllGols.pontos || 30) : 30;
                    
                //     usr.pontos_totais += (dif === 0 ? pontosBonus : -dif);
                //     usr['extra_total_gols'] = `${palpiteGols} (${dif === 0 ? 'Cravou' : -dif})`;
                // } else {
                //     usr['extra_total_gols'] = `${palpiteGols} (Pendente)`;
                // }

                // ----------------------------------------------------------------------

                const mapaExtra = [
                    { db: 'final_campeao', pal: 'campeao_id', gab: 'campeao_id', regra: 'CAMP', tipo: 'pais', tabela: paises },
                    { db: 'final_vice', pal: 'vice_id', gab: 'vice_id', regra: 'VICE', tipo: 'pais', tabela: paises },
                    { db: 'final_terceiro', pal: 'terceiro_id', gab: 'terceiro_id', regra: 'TERC', tipo: 'pais', tabela: paises },
                    { db: 'final_quarto', pal: 'quarto_id', gab: 'quarto_id', regra: 'QUAR', tipo: 'pais', tabela: paises },
                    { db: 'final_pior', pal: 'pior_time_id', gab: 'pior_time_id', regra: 'PIOR', tipo: 'pais', tabela: paises },
                    { db: 'brasil_primeiro_gol', pal: 'primeiro_gol_brasil_id', gab: 'primeiro_gol_brasil_id', regra: 'BRGOL', tipo: 'jogador', tabela: jogadores },
                    { db: 'brasil_fase_chega', pal: 'fase_brasil_id', gab: 'fase_brasil_id', regra: 'BRFASE', tipo: 'fase', tabela: fases },
                    { db: 'brasil_gols_pro', pal: 'gols_feitos_brasil', gab: 'gols_feitos_brasil', regra: 'BRG+', tipo: 'bruto', tabela: null },
                    { db: 'brasil_gols_contra', pal: 'gols_sofridos_brasil', gab: 'gols_sofridos_brasil', regra: 'BRG-', tipo: 'bruto', tabela: null },
                    { db: 'extra_pais_artilheiro', pal: 'artilheiro_pais_id', gab: 'artilheiro_pais_id', regra: 'ARTILH', tipo: 'pais', tabela: paises },
                    { db: 'extra_duelo', pal: 'duelo_gigantes', gab: 'duelo_gigantes', regra: 'CR7M10', tipo: 'bruto', tabela: null },
                    { db: 'final_copa', pal: 'final_custom', gab: 'final_custom', regra: 'FINAL_COMPLETA', tipo: 'final', tabela: paises }
                ];

                mapaExtra.forEach(m => {
                    if (m.tipo === 'final') {

                        // --- FINAL DA COPA
                        // --- TEMPORARIAMENTE FORA
                        const palpiteCamp = p.campeao_id;
                        const palpiteVice = p.vice_id;
                        const gabCamp = gabaritoFinal.campeao_id;
                        const gabVice = gabaritoFinal.vice_id;

                        const acertou = (palpiteCamp == gabCamp && palpiteVice == gabVice);
                        const nomeCamp = formatarValor(m.tabela, palpiteCamp, 'pais');
                        const nomeVice = formatarValor(m.tabela, palpiteVice, 'pais');
                        
                        usr[m.db] = `${acertou ? 'S' : 'N'} (${nomeCamp} x ${nomeVice})`;
                        
                        if (acertou) {
                            usr.pontos_totais += parseInt(headers.find(h => h.nome_reduzido === m.regra)?.pontos || 0);
                        }

                    } else {
                        // Lógica original para os outros campos...
                        const palpiteID = p[m.pal];
                        const gabaritoID = gabaritoFinal[m.gab];

                        if (m.db === 'extra_duelo') {
                            const valoresValidos = ['CR7', 'MESSI', 'EMPATE'];
                            if (!valoresValidos.includes(palpiteID) && gabaritoID == null) {
                                usr[m.db] = "-";
                                return;
                            }
                        }
                        if (gabaritoID !== null && gabaritoID !== undefined && String(gabaritoID).trim() !== '') {
                            const acertou = (palpiteID != null && String(palpiteID) === String(gabaritoID));
                            
                            // Define a cor baseada no resultado
                            const cor = acertou ? "text-emerald-300" : "text-gray-300/35";
                            
                            // Aplica a cor tanto no ícone quanto no texto
                            const icone = acertou 
                                ? `<iconify-icon icon="material-symbols:check-circle-rounded" class="${cor} text-lg"></iconify-icon>` 
                                : `<iconify-icon icon="dashicons:no" class="${cor} text-lg"></iconify-icon>`;

                            // Renderiza usando a mesma variável 'cor'
                            usr[m.db] = `${icone} <span class="text-xs ${cor} ml-1 whitespace-nowrap">${formatarValor(m.tabela, palpiteID, m.tipo)}</span>`;
                            
                            if (acertou) {
                                usr.pontos_totais += parseInt(headers.find(h => h.nome_reduzido === m.regra)?.pontos || 0);
                            }
                        } else {
                            usr[m.db] = "-";
                        }

                    }
                });
            }
        } catch (e) { console.error("Erro no processamento:", e); }
    }));

    // return usuarios.sort((a, b) => b.pontos_totais - a.pontos_totais);

    // ORDENACAO - CRITÉRIOS
    // return usuarios.sort((a, b) => {
    //     if (b.pontos_totais !== a.pontos_totais) {
    //         return b.pontos_totais - a.pontos_totais;
    //     }
    //     return a.nome.localeCompare(b.nome);
    // });
    usuarios.forEach(usr => {
        usr['placar_exato'] = usr.acertos_exatos;
        usr['placar_saldo'] = usr.acertos_saldo;
        usr['placar_vencedor'] = usr.acertos_vencedor;
        usr['placar_empate'] = usr.acertos_empate;
        usr['placar_gols'] = usr.acertos_gols;
        usr['placar_exato_contrario'] = usr.acertos_exato_neg;
        usr['placar_saldo_contrario'] = usr.acertos_saldo_neg;
        usr['placar_vencedor_contrario'] = usr.acertos_venc_neg;
    });

    return usuarios.sort((a, b) => {
        // Pontos
        if (b.pontos_totais !== a.pontos_totais) return b.pontos_totais - a.pontos_totais;
        
        // Positivos (Decrescente)
        if ((b.acertos_exatos || 0) !== (a.acertos_exatos || 0)) return (b.acertos_exatos || 0) - (a.acertos_exatos || 0);
        if ((b.acertos_saldo || 0) !== (a.acertos_saldo || 0)) return (b.acertos_saldo || 0) - (a.acertos_saldo || 0);
        if ((b.acertos_vencedor || 0) !== (a.acertos_vencedor || 0)) return (b.acertos_vencedor || 0) - (a.acertos_vencedor || 0);
        if ((b.acertos_empate || 0) !== (a.acertos_empate || 0)) return (b.acertos_empate || 0) - (a.acertos_empate || 0);
        
        // GOLS (Decrescente)
        if ((b.acertos_gols || 0) !== (a.acertos_gols || 0)) return (b.acertos_gols || 0) - (a.acertos_gols || 0);
        
        // Negativos (Crescente: menor erro ganha)
        if ((a.acertos_exato_neg || 0) !== (b.acertos_exato_neg || 0)) return (a.acertos_exato_neg || 0) - (b.acertos_exato_neg || 0);
        if ((a.acertos_saldo_neg || 0) !== (b.acertos_saldo_neg || 0)) return (a.acertos_saldo_neg || 0) - (b.acertos_saldo_neg || 0);
        if ((a.acertos_venc_neg || 0) !== (b.acertos_venc_neg || 0)) return (a.acertos_venc_neg || 0) - (b.acertos_venc_neg || 0);
        
        return a.nome.localeCompare(b.nome);
    });

    // return usuarios.sort((a, b) => {
    //     // 1º Critério: Pontos Totais
    //     if (b.pontos_totais !== a.pontos_totais) {
    //         return b.pontos_totais - a.pontos_totais;
    //     }
    //     // 2º Critério: Mais Placares Exatos
    //     if ((b.acertos_exatos || 0) !== (a.acertos_exatos || 0)) {
    //         return (b.acertos_exatos || 0) - (a.acertos_exatos || 0);
    //     }
    //     // 3º Critério: Mais Placares com Saldo
    //     if ((b.acertos_saldo || 0) !== (a.acertos_saldo || 0)) {
    //         return (b.acertos_saldo || 0) - (a.acertos_saldo || 0);
    //     }
    //     // Critério Final: Ordem alfabética
    //     return a.nome.localeCompare(b.nome);
    // });

}

function renderizarTabela(dados, headers) {
    const thead = document.querySelector('thead tr');
    const tbody = document.getElementById('container-ranking');
    if (!thead || !tbody) return;

    // Criamos o array completo com a coluna extra
    const headersComFinal = [...headers];
    if (!headersComFinal.find(h => h.coluna_db === 'final_copa')) {
        headersComFinal.push({ coluna_db: 'final_copa', nome: 'Final' });
    }
    // ADICIONE ISTO:
    if (!headersComFinal.find(h => h.coluna_db === 'placar_classificado_penaltis')) {
        headersComFinal.push({ coluna_db: 'placar_classificado_penaltis', nome: 'Penal', nome_reduzido: 'PENAL' });
    }

    const colunasComIcones = [
        'brasil_primeiro_gol',
        'final_campeao',
        'final_vice',
        'final_terceiro',
        'final_campeao',
        'final_quarto',
        'final_pior',
        'final_copa',
        'extra_duelo',
    ];

    while (thead.children.length > 3) thead.removeChild(thead.lastChild);

    headersComFinal.forEach(h => {
        const th = document.createElement('th');
        const alinhamento = colunasComIcones.includes(h.coluna_db) ? 'justify-start' : 'justify-center';
        th.className = `px-4 py-4 ${alinhamento} text-xs text-emerald-400 uppercase col-${h.coluna_db} relative`;        
        // th.className = `px-2 py-4 text-center text-xs text-emerald-400 uppercase col-${h.coluna_db} relative`;
        const textoPontos = h.pontos || 'Regra de pontuação específica.';
        const textoTipo = h.tipo || 'Regra de pontuação específica.';

        th.innerHTML = `
            <div class="flex items-center ${alinhamento} gap-1 group cursor-help">
                <span class="whitespace-nowrap">${h.nome_reduzido}</span>
                <iconify-icon icon="material-symbols:info-outline" class="text-emerald-500 text-xl"></iconify-icon>
                <div class="absolute top-full mt-2 hidden group-hover:block w-48 p-2 bg-gray-900 border border-emerald-600 text-white text-sm rounded-lg z-50 normal-case font-normal shadow-xl text-center">
                    ${textoPontos > 0 ? "+" : ""}${textoPontos}
                    ${textoTipo}
                </div>
            </div>
        `;
        thead.appendChild(th);
    });

    const dadosOrdenados = [...dados].sort((a, b) => {
        // 1. Pontos
        if (b.pontos_totais !== a.pontos_totais) return b.pontos_totais - a.pontos_totais;
        
        // 2. Critérios Positivos (Decrescente)
        if ((b.acertos_exatos || 0) !== (a.acertos_exatos || 0)) return (b.acertos_exatos || 0) - (a.acertos_exatos || 0);
        if ((b.acertos_saldo || 0) !== (a.acertos_saldo || 0)) return (b.acertos_saldo || 0) - (a.acertos_saldo || 0);
        if ((b.acertos_vencedor || 0) !== (a.acertos_vencedor || 0)) return (b.acertos_vencedor || 0) - (a.acertos_vencedor || 0);
        if ((b.acertos_empate || 0) !== (a.acertos_empate || 0)) return (b.acertos_empate || 0) - (a.acertos_empate || 0);
        
        // 3. Gols
        if ((b.acertos_gols || 0) !== (a.acertos_gols || 0)) return (b.acertos_gols || 0) - (a.acertos_gols || 0);
        
        // 4. Critérios Negativos (Crescente: Menor é melhor)
        if ((a.acertos_exato_neg || 0) !== (b.acertos_exato_neg || 0)) return (a.acertos_exato_neg || 0) - (b.acertos_exato_neg || 0);
        if ((a.acertos_saldo_neg || 0) !== (b.acertos_saldo_neg || 0)) return (a.acertos_saldo_neg || 0) - (b.acertos_saldo_neg || 0);
        if ((a.acertos_venc_neg || 0) !== (b.acertos_venc_neg || 0)) return (a.acertos_venc_neg || 0) - (b.acertos_venc_neg || 0);
        
        return a.nome.localeCompare(b.nome);
    });

    // console.log("DEBUG: Dados recebidos pelo renderizador:", dados.map(u => ({ nome: u.nome, saldo: u.acertos_saldo })));
    tbody.innerHTML = dadosOrdenados.map((usr, index) => {

        let posicao = index + 1;
        if (index > 0) {
            const anterior = dadosOrdenados[index - 1];
            
            // Eles só compartilham a posição se TUDO for igual
            const pontosIguais = usr.pontos_totais === anterior.pontos_totais;
            const exatosIguais = (usr.acertos_exatos || 0) === (anterior.acertos_exatos || 0);
            const saldoIguais  = (usr.acertos_saldo || 0) === (anterior.acertos_saldo || 0);
            const empateIguais = (usr.acertos_empate || 0) === (anterior.acertos_empate || 0);
            const vencIguais   = (usr.acertos_vencedor || 0) === (anterior.acertos_vencedor || 0);

            if (pontosIguais && exatosIguais && saldoIguais && empateIguais && vencIguais) {
                posicao = anterior.posicao;
            }
        }
        usr.posicao = posicao;

        const total = usr.pontos_totais || 0;
        const totalParticipantes = dadosOrdenados.length;

        let classeCor = "";
        let corPosicao = "text-emerald-400";
        let iconPodio = "";

        if (usr.posicao === 1) {
            classeCor = "bg-yellow-500";
            corPosicao = "text-yellow-400";
            iconPodio = ' <iconify-icon icon="emojione:trophy"></iconify-icon>';
        } else if (usr.posicao === 2) {
            classeCor = "bg-gray-400";
            corPosicao = "text-gray-300";
        } else if (usr.posicao === 3) {
            classeCor = "bg-amber-800";
            corPosicao = "text-orange-400";
        }

        const colunasDinamicas = headersComFinal.map(h => {
            let valor = usr[h.coluna_db];
            const classeColuna = `col-${h.coluna_db}`;

            // Alinhamento à esquerda para colunas de ícones
            if (colunasComIcones.includes(h.coluna_db)) {
                return `<td class="${classeColuna} px-4 py-3 text-left text-xs"><span class="flex items-center gap-1">${valor ?? '-'}</span></td>`;
            }

            // 1. Lógica específica para a FINAL
            if (h.coluna_db === 'final_copa') {
                return `<td class="${classeColuna} px-4 py-3 text-center text-xs whitespace-nowrap font-medium text-white">${valor}</td>`;
            }
            
            // 2. Colunas de penalidade
            const colunasCamp = ['campeao_perde_grupos', 'campeao_perde_16', 'campeao_perde_8', 'campeao_perde_4', 'campeao_perde_3', 'campeao_perde_final'];
            if (colunasCamp.includes(h.coluna_db)) {
                return `<td class="${classeColuna} px-4 py-3 text-center text-xs">${valor ?? 'N'}</td>`;
            }

            // 3. Colunas de grupo
            const colunasGrupos = ['grupo_primeiro', 'grupo_segundo', 'grupo_terceiro', 'grupo_quarto', 'grupo_todos_exatos'];
            if (colunasGrupos.includes(h.coluna_db)) {
                const acertos = valor ?? 0;
                let corBarra = "bg-emerald-800"; // 1 a 3
                if (acertos >= 8) {
                    corBarra = "bg-emerald-400"; // 8 a 12
                } else if (acertos >= 4) {
                    corBarra = "bg-emerald-600"; // 4 a 7
                }
                const porcentagem = Math.min((acertos / 12) * 100, 100);

                return `<td class="${classeColuna} px-4 py-3 text-center text-xs">
                    <div class="flex items-center justify-center gap-1 px-2">
                        <div class="w-8 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <!-- Aqui a classe é dinâmica -->
                            <div class="h-full ${corBarra} transition-all duration-500" style="width: ${porcentagem}%;"></div>
                        </div>
                        <span class="text-xs font-medium w-4">${acertos}</span>
                    </div>
                </td>`;
            }

            // 4. Restante
            return `<td class="${classeColuna} px-4 py-3 text-center text-xs">${valor ?? 0}</td>`;
        }).join('');

        return `<tr class="border-b border-gray-700 hover:bg-gray-700/20">
                <td class="sticky left-0 text-center bg-gray-700 col-posicao ${corPosicao} ${classeCor} font-bold text-xs px-1 md:px-4 py-3">
                    ${posicao}º
                </td>
                <td class="sticky left-[40px] md:left-[50px] bg-gray-700 ${classeCor} px-1 md:px-4 py-3">
                    ${usr.nome}
                </td>
                <td class="sticky left-[140px] md:left-[200px] text-center bg-gray-700 col-pontuacao font-bold px-1 md:px-4 py-3 ${classeCor}">
                    ${total ?? 0}
                </td>
                ${colunasDinamicas}
            </tr>`;
        }).join('');
}

function obterExplicacao(nomeReduzido) {
    const explicacoes = {
        'pontuacao': 'Soma total dos seus pontos no bolão.',
        'posicao': 'Sua classificação atual no ranking.',
        'placar_exato': 'Acerto do placar exato do jogo.',
        'placar_saldo': 'Acerto do saldo de gols do jogo.',
        'placar_vencedor': 'Acerto apenas de quem venceu a partida.',
        'placar_empate': 'Acerto do resultado de empate.',
        'placar_exato_contrario': 'Acerto do placar exato em jogos do mata-mata.',
        'placar_saldo_contrario': 'Acerto do saldo de gols em jogos do mata-mata.',
        'placar_vencedor_contrario': 'Acerto do vencedor em jogos do mata-mata.',
        'placar_gols': 'Pontuação baseada no total de gols previstos.'
    };
    
    return explicacoes[nomeReduzido] || 'Regra de pontuação específica desta etapa.';
}

function determinarFase(timeId, jogos, fases) {
    if (!timeId) return 0;
    const jogosTime = jogos.filter(j => (j.time_a_id == timeId || j.time_b_id == timeId));
    if (jogosTime.length === 0) return 0;
    const faseMax = Math.max(...jogosTime.map(j => parseInt(j.fase_id || 0)));
    // console.log(`DEBUG FASE: Time ${timeId} | Fase Máxima encontrada: ${faseMax}`); // Log crítico
    return faseMax;
}

function sanitizarResultadoFinal(resultado, jogos) {
    if (!resultado) return resultado;
    const limpo = { ...resultado };
    
    const vencedorFinal = jogos.find(j => parseInt(j.fase_id) === 7)?.vencedor_final_id;
    
    if (vencedorFinal) {
        if (parseInt(limpo.terceiro_id) === parseInt(vencedorFinal)) limpo.terceiro_id = null;
        if (parseInt(limpo.quarto_id) === parseInt(vencedorFinal)) limpo.quarto_id = null;
    }
    
    return limpo;
}

async function carregarTodasAsApostas() {
    let todas = [];
    let start = 0;
    while (true) {
        const { data } = await supabaseClient
            .from(DB_CONFIG.APOSTAS)
            .select('*, usuarios(nome)')
            .range(start, start + 999);
        
        if (!data || data.length === 0) break;
        todas.push(...data);
        if (data.length < 1000) break;
        start += 1000;
    }
    return todas;
}

document.addEventListener('DOMContentLoaded', () => {
    carregarSaudacao();
});

btnsLogout.forEach(botao => {
    botao.addEventListener('click', async () => { 
        await supabaseClient.auth.signOut(); 
        window.location.href = "index.html"; 
    });
});
