import { RegrasExtras } from './regras-extras.js';

const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', carregarRanking);
const btnsLogout = document.querySelectorAll('.btn-logout');

async function carregarRanking() {
    // 1. Obtém as referências dos elementos
    const loader = document.getElementById('loader');
    const tabelaWrapper = document.getElementById('tabela-wrapper');

    try {
        const [
            { data: headers },
            { data: apostas },
            { data: jogos },
            { data: usuarios }
        ] = await Promise.all([
            supabaseClient.from('pontuacao').select('*').order('id'),
            supabaseClient.from('apostas').select('*, usuarios(nome)'),
            supabaseClient.from('jogos').select('*, vencedor_final_id'),
            supabaseClient.from('usuarios').select('*')
        ]);

        // 2. Processa os dados
        await processarParticipantes(usuarios);
        const rankingFinal = await processarRanking(apostas, jogos, headers);
        
        // 3. Renderiza a tabela
        renderizarTabela(rankingFinal, headers);

        // 4. Sucesso: Esconde o loader e mostra a tabela
        if (loader) loader.classList.add('hidden');
        if (tabelaWrapper) tabelaWrapper.classList.remove('hidden');

    } catch (error) {
        console.error("Erro ao carregar ranking:", error);
        
        // 5. Erro: Esconde o loader e mostra uma mensagem de erro no lugar dele
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

    const { data: gabaritos } = await supabaseClient.from('grupos').select('*');
    const { data: palpiteDB } = await supabaseClient.from('palpites').select('palpites_grupos').eq('usuario_id', usuarioId);

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

    const { data: todosUsuarios } = await supabaseClient.from('usuarios').select('*');
    // 1. Inicializa o map com TODOS os usuários (os 33)
    todosUsuarios.forEach(u => {
        const usuarioObj = { 
            usuario_id: u.id, 
            nome: u.nome, 
            pontos_totais: 0,
            acertos_exatos: 0, // Adicionado
            acertos_saldo: 0   // Adicionado
        };
        headers.forEach(h => usuarioObj[h.coluna_db] = 0);
        usuarioObj['placar_classificado_penaltis'] = 0;
        rankingMap[u.id] = usuarioObj;
    });

    // 2. Agora processa as apostas apenas para somar pontos aos que já existem
    jogos.forEach(jogo => {
        if (jogo.gols_a === null || jogo.gols_b === null) return;
        apostas.forEach(aposta => {
            if (String(aposta.jogo_id) === String(jogo.id)) {
                const usr = rankingMap[aposta.usuario_id];
                if (!usr) return;
                
                let mult = (parseInt(jogo.id) > 72) ? 2 : 1;
                const res = calcularPontos(aposta.gols_a, aposta.gols_b, jogo.gols_a, jogo.gols_b, headers, mult);
                
                if (res.total > 0 || res.coluna) {
                    usr.pontos_totais += parseInt(res.total);
                }
            }
        });
    });

    const [
        { data: gabaritoBruto }, { data: paises }, { data: jogadores }, { data: fases }
    ] = await Promise.all([
        supabaseClient.from('resultados').select('*').single(),
        supabaseClient.from('paises').select('*'),
        supabaseClient.from('jogadores').select('*'),
        supabaseClient.from('fases').select('*')
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
        if (jogo.gols_a === null || jogo.gols_b === null) return;
        apostas.forEach(aposta => {
            if (String(aposta.jogo_id) === String(jogo.id)) {
                const usr = rankingMap[aposta.usuario_id];
                let mult = (parseInt(jogo.id) > 72) ? 2 : 1;
                const res = calcularPontos(aposta.gols_a, aposta.gols_b, jogo.gols_a, jogo.gols_b, headers, mult);
                
                if (res.total > 0 || res.coluna) {
                    usr.pontos_totais += parseInt(res.total);

                    // --- ADICIONE ISSO AQUI PARA O DESEMPATE ---
                    // (Verifique se o seu 'calcularPontos' retorna exatamente estas propriedades 'exato' e 'saldo')
                    if (res.exato) usr.acertos_exatos += 1;
                    if (res.saldo) usr.acertos_saldo += 1;
                    // --------------------------------------------0

                    const valorRegraGols = parseInt(headers.find(h => h.nome_reduzido === 'GOLS')?.pontos || 1);
                    const qtdGols = (res.bonus || 0) / valorRegraGols;
                    if (res.coluna) usr[res.coluna] = (usr[res.coluna] || 0) + 1;
                    usr['placar_gols'] = (usr['placar_gols'] || 0) + qtdGols;
                }
            }
        });
    });

    const usuarios = Object.values(rankingMap);

    await Promise.all(usuarios.map(async (usr) => {

        const resG = await processarGrupos(usr.usuario_id, headers, 12);

        usr.pontos_totais += resG.total;
        usr['grupo_primeiro'] = resG.contagem[1]; usr['grupo_segundo'] = resG.contagem[2];
        usr['grupo_terceiro'] = resG.contagem[3]; usr['grupo_quarto'] = resG.contagem[4];
        usr['grupo_todos_primeiros'] = resG.contagem.ALL1 ? 'S' : 'N';
        usr['grupo_todos_segundos'] = resG.contagem.ALL2 ? 'S' : 'N';
        usr['grupo_todos_terceiros'] = resG.contagem.ALL3 ? 'S' : 'N';
        usr['grupo_todos_quartos'] = resG.contagem.ALL4 ? 'S' : 'N';
        usr['grupo_todos_exatos'] = resG.contagem.ALLG;

        try {
            const { data: pList } = await supabaseClient.from('palpites').select('*').eq('usuario_id', usr.usuario_id);

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
                            if (!valoresValidos.includes(palpiteID)) {
                                usr[m.db] = "-";
                                return;
                            }
                        }
                        if (gabaritoID != null) {
                            const acertou = (palpiteID != null && String(palpiteID) === String(gabaritoID));
                            usr[m.db] = `${acertou ? 'S' : 'N'} (${formatarValor(m.tabela, palpiteID, m.tipo)})`;
                            if (acertou) usr.pontos_totais += parseInt(headers.find(h => h.nome_reduzido === m.regra)?.pontos || 0);
                        } else usr[m.db] = "-";


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

    return usuarios.sort((a, b) => {
        // 1º Critério: Pontos Totais
        if (b.pontos_totais !== a.pontos_totais) {
            return b.pontos_totais - a.pontos_totais;
        }
        // 2º Critério: Mais Placares Exatos
        if ((b.acertos_exatos || 0) !== (a.acertos_exatos || 0)) {
            return (b.acertos_exatos || 0) - (a.acertos_exatos || 0);
        }
        // 3º Critério: Mais Placares com Saldo
        if ((b.acertos_saldo || 0) !== (a.acertos_saldo || 0)) {
            return (b.acertos_saldo || 0) - (a.acertos_saldo || 0);
        }
        // Critério Final: Ordem alfabética
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

    while (thead.children.length > 3) thead.removeChild(thead.lastChild);
    headersComFinal.forEach(h => {
        const th = document.createElement('th');
        th.className = `px-2 py-4 text-center text-xs text-emerald-400 uppercase col-${h.coluna_db} relative`;
        const textoPontos = h.pontos || 'Regra de pontuação específica.';
        const textoTipo = h.tipo || 'Regra de pontuação específica.';

        th.innerHTML = `
            <div class="flex items-center justify-center gap-1 group cursor-help">
                ${h.nome_reduzido}
                <iconify-icon icon="material-symbols:info-outline" class="text-emerald-500"></iconify-icon>
                
                <div class="absolute top-full mt-2 hidden group-hover:block w-48 p-2 bg-gray-900 border border-emerald-600 text-white text-sm rounded-lg z-50 normal-case font-normal shadow-xl text-center">
                    ${textoPontos > 0? "+" : ""}${textoPontos}
                    ${textoTipo}
                </div>
            </div>
        `;
        thead.appendChild(th);
    });

    tbody.innerHTML = dados.map((usr, index) => {
        const total = usr.pontos_totais || 0; 
        
        // AGORA USAMOS headersComFinal AQUI!
        const colunasDinamicas = headersComFinal.map(h => {
            let valor = usr[h.coluna_db];
            const classeColuna = `col-${h.coluna_db}`;

            // 1. Lógica específica para a FINAL
            if (h.coluna_db === 'final_copa') {
                return `<td class="${classeColuna} px-2 py-3 text-center text-xs whitespace-nowrap font-medium text-white">${valor}</td>`;
            }
            
            // 2. Colunas de penalidade
            const colunasCamp = ['campeao_perde_grupos', 'campeao_perde_16', 'campeao_perde_8', 'campeao_perde_4', 'campeao_perde_3', 'campeao_perde_final'];
            if (colunasCamp.includes(h.coluna_db)) {
                return `<td class="${classeColuna} px-2 py-3 text-center text-xs">${valor ?? 'N'}</td>`;
            }

            // 3. Colunas de grupo
            const colunasGrupos = ['grupo_primeiro', 'grupo_segundo', 'grupo_terceiro', 'grupo_quarto', 'grupo_todos_exatos'];
            if (colunasGrupos.includes(h.coluna_db)) {
                return `<td class="${classeColuna} px-2 py-3 text-center text-xs">${valor ?? 0}/12</td>`;
            }

            // 4. Restante
            return `<td class="${classeColuna} px-2 py-3 text-center text-xs">${valor ?? 0}</td>`;
        }).join('');

        return `<tr class="border-b border-gray-700 hover:bg-gray-700/20">
            <td class="md:sticky px-2 py-3 min-w-[50px] max-w-[50px] w-[50px] left-0 text-center bg-gray-700 text-xs text-center col-posicao">${index + 1}º</td>
            <td class="md:sticky px-2 py-3 min-w-[150px] max-w-[150px] w-[150px] left-[50px] bg-gray-700">${usr.nome}</td>
            <td class="md:sticky px-2 py-3 min-w-[100px] max-w-[100px] w-[100px] left-[200px] text-center bg-gray-700 col-pontuacao">
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

document.addEventListener('DOMContentLoaded', () => {
    carregarSaudacao();
});

btnsLogout.forEach(botao => {
    botao.addEventListener('click', async () => { 
        await supabaseClient.auth.signOut(); 
        window.location.href = "index.html"; 
    });
});
