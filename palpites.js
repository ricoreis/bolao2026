import { RegrasExtras } from './regras-extras.js';
import { supabaseClient } from './supabase-config.js';
import { carregarSaudacao } from './auth-header.js';

// const btnLogout = document.getElementById('btn-logout');
const btnsLogout = document.querySelectorAll('.btn-logout');
const toast = document.getElementById('toast');

let configRegras = [];
let listaFases = [];
let todosJogos = [];
let gabaritoGlobal = null;

const STATUS_TRAVAS = {
    'primeiro_gol_brasil_id': false,
    'campeao_id': true,
    'vice_id': true,
    'terceiro_id': true,
    'quarto_id': true,
    'pior_time_id': false,
    'duelo_gigantes': false,
    'artilheiro_pais_id': false,
    'fase_brasil_id': false,  
    'gols_feitos_brasil': false, 
    'gols_sofridos_brasil': false
};

function showToast(mensagem) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = mensagem;
        
        toast.className = "fixed bottom-5 right-5 z-[60] text-white px-5 py-3 rounded-lg shadow-xl font-medium bg-emerald-600 transition-all duration-300 opacity-100 translate-y-0";
        
        setTimeout(() => {
            toast.className = "fixed bottom-5 right-5 z-[60] text-white px-5 py-3 rounded-lg shadow-xl font-medium bg-emerald-600 transition-all duration-300 translate-y-[-20px] opacity-0";
        }, 3000);
    }
}

function atualizarCampoEView(idCampo, valor) {
    const el = document.getElementById(idCampo);
    const span = document.getElementById('display-' + idCampo);
    
    if (!el) return;
    
    el.value = valor;
    
    if (span) {
        if (el.tagName === 'SELECT') {
            // Se for select, busca o texto da opção pelo valor
            const option = el.querySelector(`option[value="${valor}"]`);
            span.textContent = option ? option.text : "-";
        } else {
            span.textContent = valor || "-";
        }
    }
}

// --- LÓGICA DE MOTOR E PENALIDADES ---
const faseEstaCompleta = (faseId) => {
    const jogos = todosJogos.filter(j => parseInt(j.fase_id) === parseInt(faseId));
    return jogos.length > 0 && jogos.every(j => j.time_a_id !== null && j.time_b_id !== null);
};

const timeNaFase = (faseId, idNum) => {
    return todosJogos.some(j => parseInt(j.fase_id) === parseInt(faseId) && (parseInt(j.time_a_id) === idNum || parseInt(j.time_b_id) === idNum));
};

async function verificarPenalidadeCampeao(idNum) {
    if (!idNum) return;
    const todasFases = [1, 2, 3, 4, 5, 6, 7];
    const statusFases = todasFases.map(fId => ({ fase: fId, completa: faseEstaCompleta(fId), participa: timeNaFase(fId, idNum) }));
    const fasesQueTimeParticipou = statusFases.filter(s => s.completa && s.participa).map(s => s.fase);

    if (fasesQueTimeParticipou.length === 0) return;

    const faseMaximaAtingida = Math.max(...fasesQueTimeParticipou);

    if (faseMaximaAtingida === 7) {
        const jogoFinal = todosJogos.find(j => parseInt(j.fase_id) === 7);
        if (jogoFinal?.vencedor_final_id !== null && parseInt(jogoFinal.vencedor_final_id) !== idNum) {
            const faseObj = listaFases.find(f => parseInt(f.id) === 7);
            aplicarPenalidade('CAMPVICE', faseObj?.nome || 'Final', 7);
        }
    } else {
        const proximaFase = faseMaximaAtingida + 1;
        if (faseEstaCompleta(proximaFase) && !timeNaFase(proximaFase, idNum)) {
            const faseObj = listaFases.find(f => parseInt(f.id) === parseInt(faseMaximaAtingida));
            const codigoRegra = faseObj?.codigo_regra || 'CAMPGR';
            aplicarPenalidade(codigoRegra, faseObj?.nome || `Fase ${faseMaximaAtingida}`, faseMaximaAtingida);
        }
    }
}

function aplicarPenalidade(codigoRegra, nomeFase, faseId) {
    const regra = configRegras.find(r => r.nome_reduzido === codigoRegra);
    if (!regra || regra.pontos >= 0) return;

    const listaBonus = document.getElementById('lista-bonus');
    const item = document.createElement('div');
    item.className = "text-red-400 font-bold text-sm mt-1";
    
    if (parseInt(faseId) === 7) {
        item.textContent = `${regra.pontos} pts Seu campeão perdeu a final`;
    } else {
        item.textContent = `${regra.pontos} pts Seu campeão ficou na ${nomeFase}`;
    }
    listaBonus.appendChild(item);
}

// --- FLUXO PRINCIPAL ---
async function carregarDadosIniciais() {

    const loader = document.getElementById('loader');

    try {

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) { window.location.href = "index.html"; return; }

        const tempoMinimo = new Promise(resolve => setTimeout(resolve, 3000));

        const [regras, gab, jogadores, fases, paises, userData, jogos] = await Promise.all([
            supabaseClient.from('pontuacao').select('*'),
            supabaseClient.from('resultados').select('*').eq('id', 1).single(),
            supabaseClient.from('jogadores').select('id, nome, clube, posicao').order('nome'),
            supabaseClient.from('fases').select('id, nome, codigo_regra').order('id'),
            supabaseClient.from('paises').select('id, nome, elite').order('nome'),
            supabaseClient.from('usuarios').select('nome').eq('id', session.user.id).single(),
            supabaseClient.from('jogos').select('fase_id, time_a_id, time_b_id, vencedor_final_id'),
            tempoMinimo
        ]);

        configRegras = regras.data || [];
        gabaritoGlobal = gab.data;
        listaFases = fases.data || [];
        todosJogos = jogos.data || [];
        
        popularSelect('sel-fase', fases.data, (f) => f.nome);
        // ['sel-campeao', 'sel-vice', 'sel-terceiro', 'sel-quarto', 'sel-pior', 'sel-artilheiro-pais'].forEach(id => popularSelect(id, paises.data, (p) => p.nome));
        ['sel-campeao', 'sel-vice', 'sel-terceiro', 'sel-quarto', 'sel-pior', 'sel-artilheiro-pais'].forEach(id => {
            popularSelectAgrupadoPaises(id, paises.data);
        });

        popularSelect('sel-fase', fases.data, (f) => f.nome, 5);

        popularSelectAgrupado('sel-gol', jogadores.data);
        
        ['sel-campeao', 'sel-vice', 'sel-terceiro', 'sel-quarto'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', validarSelecoesClassificacao);
        });

        // configurarValidacaoSelecoes();
        carregarPalpitesEComparar();

        if (loader) loader.classList.add('hidden');

    } catch (error) {
        
        console.error("Erro ao carregar jogos:", error);
        
        // 4. Erro: mostra o feedback visual
        if (loader) {
            loader.innerHTML = `
                <div class="text-center p-6">
                    <iconify-icon class="text-5xl text-red-500" icon="material-symbols:error-outline"></iconify-icon>
                    <p class="text-red-400 mt-4">Erro ao carregar jogos.</p>
                    <button onclick="window.location.reload()" class="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg text-sm">Tentar novamente</button>
                </div>
            `;
        }

    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

function popularSelect(id, dados, formatter, idParaExcluir = null) {
    const select = document.getElementById(id);
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione...</option>';
    
    if (dados) {
        dados.forEach(item => {
            // Se o ID for o que queremos excluir, simplesmente pulamos este loop
            if (idParaExcluir && parseInt(item.id) === parseInt(idParaExcluir)) return;
            
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = formatter(item);
            select.appendChild(option);
        });
    }
}

function popularSelectAgrupado(id, dados) {
    const select = document.getElementById(id);
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione...</option>';
    
    // 1. Extrair o jogador especial (ID 27) e os demais
    const jogadorEspecial = dados.find(j => j.id === 27);
    const demaisJogadores = dados.filter(j => j.id !== 27);

    // 2. Adicionar o especial no topo como uma opção comum (fora de grupo)
    if (jogadorEspecial) {
        const option = document.createElement('option');
        option.value = jogadorEspecial.id;
        option.textContent = jogadorEspecial.nome;
        select.appendChild(option);
    }

    // 3. Agrupar apenas os demais por posição
    const grupos = demaisJogadores.reduce((acc, item) => {
        const pos = item.posicao || 'Outros';
        if (!acc[pos]) acc[pos] = [];
        acc[pos].push(item);
        return acc;
    }, {});

    // 4. Definir a ordem desejada para os grupos
    const ordemPreferencial = ['Goleiro', 'Defensor', 'Meia', 'Atacante'];
    const chavesOrdenadas = [...ordemPreferencial, ...Object.keys(grupos).filter(k => !ordemPreferencial.includes(k))];

    // 5. Adicionar os grupos com os jogadores
    chavesOrdenadas.forEach(posicao => {
        if (!grupos[posicao]) return; 

        const optgroup = document.createElement('optgroup');
        optgroup.label = posicao;
        
        grupos[posicao].sort((a, b) => a.id - b.id).forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.nome} (${item.clube})`;
            optgroup.appendChild(option);
        });
        select.appendChild(optgroup);
    });
}

function popularSelectAgrupadoPaises(id, dados) {
    const select = document.getElementById(id);
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione...</option>';
    
    // 1. Agrupar os países pelo campo 'elite'
    // Supondo que elite seja true/false ou um nome como "Campeões", "Outros"
    const grupos = dados.reduce((acc, item) => {
        const grupo = item.elite ? "Elite" : "Outros";
        if (!acc[grupo]) acc[grupo] = [];
        acc[grupo].push(item);
        return acc;
    }, {});

    // 2. Definir a ordem (Elite primeiro)
    const chavesOrdenadas = ["Elite", "Outros"];

    // 3. Adicionar ao select
    chavesOrdenadas.forEach(nomeGrupo => {
        if (!grupos[nomeGrupo]) return; 

        const optgroup = document.createElement('optgroup');
        optgroup.label = nomeGrupo;
        
        // Ordena alfabeticamente dentro de cada grupo
        grupos[nomeGrupo].sort((a, b) => a.nome.localeCompare(b.nome)).forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.nome;
            optgroup.appendChild(option);
        });
        select.appendChild(optgroup);
    });
}

async function carregarPalpitesEComparar() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data: p } = await supabaseClient.from('palpites').select('*').eq('usuario_id', user.id).single();
    
    if (p) {
        // document.getElementById('sel-gol').value = p.primeiro_gol_brasil_id || '';
        // document.getElementById('sel-fase').value = p.fase_brasil_id || '';
        // document.getElementById('sel-campeao').value = p.campeao_id || '';
        // document.getElementById('sel-vice').value = p.vice_id || '';
        // document.getElementById('sel-terceiro').value = p.terceiro_id || '';
        // document.getElementById('sel-quarto').value = p.quarto_id || '';
        // document.getElementById('sel-pior').value = p.pior_time_id || '';
        // document.getElementById('sel-artilheiro-pais').value = p.artilheiro_pais_id || '';
        // document.getElementById('inp-gols-pro').value = p.gols_feitos_brasil || 0;
        // document.getElementById('inp-gols-contra').value = p.gols_sofridos_brasil || 0;
        // document.getElementById('sel-cr7-messi').value = p.duelo_gigantes || '';

        atualizarCampoEView('sel-gol', p.primeiro_gol_brasil_id);
        atualizarCampoEView('sel-fase', p.fase_brasil_id);
        atualizarCampoEView('sel-campeao', p.campeao_id);
        atualizarCampoEView('sel-vice', p.vice_id);
        atualizarCampoEView('sel-terceiro', p.terceiro_id);
        atualizarCampoEView('sel-quarto', p.quarto_id);
        atualizarCampoEView('sel-pior', p.pior_time_id);
        atualizarCampoEView('sel-artilheiro-pais', p.artilheiro_pais_id);
        atualizarCampoEView('inp-gols-pro', p.gols_feitos_brasil);
        atualizarCampoEView('inp-gols-contra', p.gols_sofridos_brasil);
        atualizarCampoEView('sel-cr7-messi', p.duelo_gigantes);

        const totalGolsCalculado = await calcularTotalGolsReal(user.id);
        const totalGolsOficial = await calcularTotalGolsOficial(); // <--- NOVA CHAMADA
        
        // Se quiser exibir no input para o usuário ver (mas desabilitado):
        const inputGols = document.getElementById('inp-total-gols');
        inputGols.value = totalGolsCalculado;
        inputGols.disabled = true; // Assim o usuário sabe que é automático

        if (gabaritoGlobal) {
            exibirPontos(p, gabaritoGlobal, totalGolsCalculado, totalGolsOficial);
            verificarPenalidadeCampeao(p.campeao_id);

            // LÓGICA NOVA: Só mostra se houver elementos filhos em 'lista-bonus'
            const listaBonus = document.getElementById('lista-bonus');
            const boxBonus = document.getElementById('box-bonus');
            
            // Verifica se a lista tem conteúdo (se há penalidades ou avisos)
            if (listaBonus.children.length > 0) {
                boxBonus.classList.remove('hidden');
            } else {
                boxBonus.classList.add('hidden');
            }
        }
    }
}

function exibirPontos(palpite, gabarito, totalGolsCalculado, totalGolsOficial) {
    const extrair = (val) => (val && typeof val === 'object' && 'id' in val) ? parseInt(val.id) : parseInt(val);
    const map = [
        { id: 'pts-gol-brasil', p: palpite.primeiro_gol_brasil_id, g: gabarito.primeiro_gol_brasil_id, pts: 'BRGOL', tipo: 'simples' },
        { id: 'pts-fase-brasil', p: palpite.fase_brasil_id, g: gabarito.fase_brasil_id, pts: 'BRFASE', tipo: 'simples' },
        { id: 'pts-gols-pro', p: palpite.gols_feitos_brasil, g: gabarito.gols_feitos_brasil, pts: 'BRG+', tipo: 'simples' },
        { id: 'pts-gols-contra', p: palpite.gols_sofridos_brasil, g: gabarito.gols_sofridos_brasil, pts: 'BRG-', tipo: 'simples' },
        { id: 'pts-artilheiro', p: palpite.artilheiro_pais_id, g: gabarito.artilheiro_pais_id, pts: 'ARTILH', tipo: 'simples' },
        { id: 'pts-campeao', p: palpite.campeao_id, g: gabarito.campeao_id, pts: 'CAMP', tipo: 'simples' },
        { id: 'pts-vice', p: palpite.vice_id, g: gabarito.vice_id, pts: 'VICE', tipo: 'simples' },
        { id: 'pts-terceiro', p: palpite.terceiro_id, g: gabarito.terceiro_id, pts: 'TERC', tipo: 'simples' },
        { id: 'pts-quarto', p: palpite.quarto_id, g: gabarito.quarto_id, pts: 'QUAR', tipo: 'simples' },
        { id: 'pts-pior', p: palpite.pior_time_id, g: gabarito.pior_time_id, pts: 'PIOR', tipo: 'simples' },
        { id: 'pts-cr7-messi', p: palpite.duelo_gigantes, g: gabarito.duelo_gigantes, pts: 'CR7M10', tipo: 'duelo' },
        { id: 'pts-total-gols', p: totalGolsCalculado, g: gabarito.total_gols, pts: 'ALLGOLS', tipo: 'total' }
    ];

    map.forEach(item => {
        const pBase = RegrasExtras.obterPontos(item.pts, configRegras);
        let pontos = 0;
        if (item.tipo === 'simples') pontos = RegrasExtras.calcularSimples(extrair(item.p), extrair(item.g), pBase);
        else if (item.tipo === 'duelo') pontos = RegrasExtras.calcularDueloGigantes(item.p, item.g, pBase);
        else if (item.tipo === 'total') pontos = RegrasExtras.calcularTotalGols(item.p, item.g, pBase);
        
        const el = document.getElementById(item.id);
        if (el) {
            el.textContent = `${pontos > 0 ? '+' : ''}${pontos}`;
            el.className = `hidden text-sm text-gray-800 mt-1 rounded-full px-2 py-1 w-fit h-fit ${pontos > 0 ? 'bg-amber-400' : 'bg-red-400'}`;
            if (pontos != 0) {
                el.classList.remove("hidden")
                // console.log(pontos + "");
            }
        }
    });

    // Lógica para o total de gols (único span)
    const elPts = document.getElementById('pts-total-gols');
    const elPtsCopa = document.getElementById('pts-total-gols_copa');
    
    if (elPts) {
        const p = parseInt(totalGolsCalculado);
        const g = parseInt(totalGolsOficial);
        const diff = p - g;
        
        // Calcula a pontuação
        const pBase = RegrasExtras.obterPontos('ALLGOLS', configRegras);
        const pontos = RegrasExtras.calcularTotalGols(p, g, pBase);
        
        // Monta a string final: "Pontos (Diferença | Total Copa: X)"
        const textoPontos = `${pontos >= 0 ? '+' : ''}${pontos}`;
        const textoInfo = `Gols na Copa: ${g}`;
        
        elPts.textContent = `${textoPontos}`;
        elPtsCopa.textContent = `${textoInfo}`;
        
        // Estilização condicional
        elPts.className = `text-sm text-gray-800 mt-1 rounded-full px-2 py-1 w-fit h-fit ${pontos > 0 ? 'bg-amber-400' : pontos == 0 ? 'bg-gray-700' : 'bg-red-400'}`;
    }
}

// Função para somar os gols baseada nos palpites salvos na tabela 'apostas'
async function calcularTotalGolsReal(usuarioId) {
    const { data: apostas } = await supabaseClient
        .from('apostas')
        .select('gols_a, gols_b')
        .eq('usuario_id', usuarioId);

    if (!apostas) return 0;
    
    // Soma todos os gols a favor e contra de todas as apostas do usuário
    return apostas.reduce((total, a) => total + (a.gols_a || 0) + (a.gols_b || 0), 0);
}

async function calcularTotalGolsOficial() {
    // Busca todos os jogos que já foram realizados
    const { data: jogos } = await supabaseClient
        .from('jogos')
        .select('gols_a, gols_b')
        .not('gols_a', 'is', null); // Garante que pegamos apenas jogos com placar

    if (!jogos) return 0;
    return jogos.reduce((total, j) => total + (j.gols_a || 0) + (j.gols_b || 0), 0);
}

async function verificarPrazo() {
    const { data: jogo } = await supabaseClient
        .from('jogos')
        .select('data_jogo')
        .eq('id', 1)
        .single();

    const dataJogo = new Date(jogo.data_jogo).getTime();
    const agora = new Date().getTime();
    const duasHorasEmMs = 2 * 60 * 60 * 1000;

    // Elementos da UI
    const containerPai = document.getElementById('container-controle-apostas'); // O ID do novo container pai
    const btnSalvar = document.getElementById('btn-salvar');
    const divEncerrado = document.getElementById('msg-apostas-encerradas');
    const instrucoes = document.getElementById('instrucoes');

    // Lógica de Prazo
    // const prazoEncerrado = false; 
    // if (prazoEncerrado) {
    if ((dataJogo - agora) < duasHorasEmMs) {
        // PRAZO ENCERRADO
        travarInputs(); // Desabilita os inputs
        if (btnSalvar) btnSalvar.classList.add('hidden');
        if (divEncerrado) divEncerrado.classList.remove('hidden');
        if (instrucoes) instrucoes.classList.add('hidden');        
        // showToast("Apostas encerradas!");
    } else {
        // PRAZO ABERTO
        if (btnSalvar) btnSalvar.classList.remove('hidden');
        if (divEncerrado) divEncerrado.classList.add('hidden');
        if (instrucoes) instrucoes.classList.remove('hidden');
    }

    // A MÁGICA: Só remove o 'hidden' do container pai AGORA, 
    // após o JS decidir o que deve ser mostrado dentro dele.
    if (containerPai) containerPai.classList.remove('hidden');
}

function travarInputs() {
    // 1. Trava e oculta todos os campos de entrada (select, input, textarea)
    document.querySelectorAll('select, input, textarea').forEach(i => {
        i.disabled = true;
        i.classList.add('hidden');
        
        // Mostra o span correspondente
        const span = document.getElementById('display-' + i.id);
        if (span) span.classList.remove('hidden');
    });

    // 2. Gerencia a visibilidade dos botões de rodapé
    const btnSalvar = document.getElementById('btn-salvar-palpites');
    const divEncerrado = document.getElementById('msg-apostas-encerradas');
    const instrucoes = document.getElementById('instrucoes');
    
    if (btnSalvar) btnSalvar.classList.add('hidden');
    if (divEncerrado) divEncerrado.classList.remove('hidden');
    
    // 3. Oculta instruções se existirem
    if (instrucoes) instrucoes.classList.add('hidden');
}

async function salvarPalpites() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const dados = {
        usuario_id: user.id,
        primeiro_gol_brasil_id: parseInt(document.getElementById('sel-gol').value) || null,
        fase_brasil_id: parseInt(document.getElementById('sel-fase').value) || null,
        campeao_id: parseInt(document.getElementById('sel-campeao').value) || null,
        vice_id: parseInt(document.getElementById('sel-vice').value) || null,
        terceiro_id: parseInt(document.getElementById('sel-terceiro').value) || null,
        quarto_id: parseInt(document.getElementById('sel-quarto').value) || null,
        pior_time_id: parseInt(document.getElementById('sel-pior').value) || null,
        artilheiro_pais_id: parseInt(document.getElementById('sel-artilheiro-pais').value) || null,
        gols_feitos_brasil: parseInt(document.getElementById('inp-gols-pro').value) || 0,
        gols_sofridos_brasil: parseInt(document.getElementById('inp-gols-contra').value) || 0,
        duelo_gigantes: document.getElementById('sel-cr7-messi').value
    };

    const { error } = await supabaseClient.from('palpites').upsert(dados, { onConflict: 'usuario_id' });
    if (error) showToast("Erro: " + error.message, true);
    else showToast("Palpites salvos!");
}

function validarSelecoesClassificacao() {
    const ids = ['sel-campeao', 'sel-vice', 'sel-terceiro', 'sel-quarto'];
    const selects = ids.map(id => document.getElementById(id));
    const spanErro = document.getElementById('erro-classificacao'); // Agora vai achar!
    const btnSalvar = document.getElementById('btn-salvar');
    
    let temErro = false;
    const contagem = {};

    // 1. Limpeza visual
    selects.forEach(s => s.classList.remove('border-red-500', 'bg-red-900/20'));
    
    // 2. Mapeamento
    selects.forEach(s => {
        if (s.value !== "") {
            if (!contagem[s.value]) contagem[s.value] = [];
            contagem[s.value].push(s);
        }
    });

    // 3. Verificação de conflito
    Object.keys(contagem).forEach(val => {
        if (contagem[val].length > 1) {
            contagem[val].forEach(s => {
                s.classList.add('border-red-500', 'bg-red-900/20');
            });
            temErro = true;
        }
    });

    // 4. Exibição do erro (Sem depender de classes ocultas prévias)
    if (spanErro) {
        if (temErro) {
            spanErro.textContent = "Os países selecionados devem ser diferentes!";
            spanErro.classList.remove('hidden'); // Força a exibição
        } else {
            spanErro.textContent = "";
            spanErro.classList.add('hidden');    // Esconde quando não tem erro
        }
    }

    // 5. Botão
    if (btnSalvar) {
        btnSalvar.disabled = temErro;
        btnSalvar.classList.toggle('opacity-50', temErro);
    }
}

async function verificarStatusTrava(coluna) {
    // 1. Busca a data de trava para essa categoria específica
    const { data, error } = await supabaseClient
        .from('config_trava')
        .select('data_trava')
        .eq('categoria', coluna)
        .single();

    if (error || !data) return true; // Se não tiver config, trava por segurança

    // 2. Compara com a data atual
    const agora = new Date();
    const dataTrava = new Date(data.data_trava);
    
    return agora < dataTrava; // Retorna true se estiver bloqueado
}

function estaBloqueado(coluna) {
    // Se não estiver no objeto, assume que está bloqueado (por segurança)
    return STATUS_TRAVAS.hasOwnProperty(coluna) ? STATUS_TRAVAS[coluna] : true;
}

function atualizarLegendas(dadosFinais, hexCores) {
    const container = document.getElementById('container-legendas');
    container.innerHTML = ''; // Limpa as legendas antigas

    dadosFinais.forEach((item, index) => {
        const nome = item[0];
        const votos = item[1];
        const cor = hexCores[index] || '#64748B'; // Usa a cor ou cinza padrão

        const span = document.createElement('span');
        span.className = 'flex items-center gap-1';
        span.innerHTML = `
            <i class="w-3 h-3 rounded-full" style="background-color: ${cor}"></i> 
            <span>${nome} (${votos}v)</span>
        `;
        container.appendChild(span);
    });
}

const gerarSecaoCriterio = (titulo, listaApostas) => {
    // Retorna apenas a lista de usuários, sem o valor ao lado
    return `
        <tr><td colspan="2" class="bg-gray-800 text-emerald-500 font-bold text-sm uppercase">
            <span class="bg-black/20 w-full flex rounded-lg px-4 py-4 mb-6">
                ${titulo}
            </span>
        </td></tr>
        ${listaApostas.map(a => `
            <tr class="border-b border-gray-700/30">
                <td class="py-2 text-gray-300 pl-2">${a.usuario}</td>
            </tr>
        `).join('')}
        <tr><td class="h-16"></td></tr>
    `;
};

function mostrarGrafico(tipo) {
    const contDonut = document.getElementById('container-grafico-donut');
    const contBar = document.getElementById('container-grafico-bar');
    
    // Esconde tudo
    contDonut.classList.add('hidden');
    contBar.classList.add('hidden');
    
    // Mostra o escolhido
    if (tipo === 'donut') {
        contDonut.classList.remove('hidden');
        return document.getElementById('canvas-donut').getContext('2d');
    } else {
        contBar.classList.remove('hidden');
        return document.getElementById('canvas-bar').getContext('2d');
    }
}

async function abrirModalCriterio(coluna, titulo, tipo) {
    // No início da abrirModalCriterio:
    document.getElementById('container-grafico-donut').classList.remove('hidden');
    document.getElementById('container-grafico-bar').classList.add('hidden');
    document.getElementById('container-legendas').classList.remove('hidden');

    const tituloModal = document.querySelector('#modal-apostas h3');
    const lista = document.getElementById('lista-apostas-modal');
    lista.innerHTML = '<tr><td class="text-red-500 font-bold">TESTE: INJEÇÃO FUNCIONANDO</td></tr>';
    const containerLegendas = document.getElementById('container-legendas');
    
    // Elementos do palpite pessoal
    const containerMeuPalpite = document.getElementById('meu-palpite-container');
    const valorMeuPalpite = document.getElementById('meu-palpite-valor');

    tituloModal.innerText = titulo;
    document.body.classList.add('modal-aberto');
    document.getElementById('modal-loader').classList.remove('hidden'); 
    document.getElementById('modal-apostas').classList.remove('hidden');
    lista.innerHTML = '<tr><td class="p-4 text-center text-gray-400">Carregando...</td></tr>';
    
    // Esconde o container do seu palpite inicialmente
    if (containerMeuPalpite) containerMeuPalpite.classList.add('hidden');

    const tabelaMap = {
        'jogadores': { tabela: 'jogadores', coluna: 'nome' },
        'fases': { tabela: 'fases', coluna: 'nome' },
        'paises': { tabela: 'paises', coluna: 'nome' },
        'fixo': { tabela: null }    
    };
    
    const config = tabelaMap[tipo] || { tabela: 'jogadores', coluna: 'nome' };

    const { data: { user } } = await supabaseClient.auth.getUser();
    
    const promessas = [
        supabaseClient.from('palpites').select(`usuario_id, ${coluna}`),
        supabaseClient.from('usuarios').select('id, nome')
    ];

    if (config.tabela) {
        promessas.push(supabaseClient.from(config.tabela).select('id, nome'));
    }

    const resultados = await Promise.all(promessas);
    const apostas = resultados[0].data;
    const usuarios = resultados[1].data;
    const itens = config.tabela ? resultados[2].data : null;

    if (!apostas || !usuarios) return;

    // 2. Mapeamento
    const mapaUsuarios = Object.fromEntries(usuarios.map(u => [u.id, u.nome]));
    const mapaItens = itens ? Object.fromEntries(itens.map(i => [i.id, i.nome])) : {};

    // 3. Processamento e Lógica do Meu Palpite
    const minhaAposta = apostas.find(a => a.usuario_id === user?.id);
    if (minhaAposta && minhaAposta[coluna] !== null && containerMeuPalpite) {
        let valorAposta = minhaAposta[coluna];
        
        // CORREÇÃO: Tratamento específico para gols OU labels fixos
        if (tipo === 'gols_pro' || tipo === 'gols_contra') {
            valorAposta = `${valorAposta} gol(s)`;
        } 
        else if (tipo === 'fixo' && coluna === 'duelo_gigantes') {
            const labels = { 'CR7': 'Cristiano Ronaldo', 'MESSI': 'Lionel Messi', 'EMPATE': 'Empate' };
            valorAposta = labels[valorAposta] || valorAposta;
        } 
        // Só busca no mapaItens se não for nenhum dos casos acima
        else if (mapaItens && mapaItens[valorAposta]) {
            valorAposta = mapaItens[valorAposta];
        }

        valorMeuPalpite.innerText = valorAposta;
        containerMeuPalpite.classList.remove('hidden');
    }

    const listaFinal = apostas
        .filter(a => a[coluna] !== null)
        .map(a => {
            let valor = a[coluna];
            if (tipo === 'fixo' && coluna === 'duelo_gigantes') {
                const labels = { 'CR7': 'Cristiano Ronaldo', 'MESSI': 'Lionel Messi', 'EMPATE': 'Empate' };
                valor = labels[valor] || valor;
            } else {
                valor = mapaItens[valor] || 'ID Desconhecido';
            }
            return { usuario: mapaUsuarios[a.usuario_id] || 'Anon', valor };
        })
        .sort((a, b) => a.usuario.localeCompare(b.usuario));

    // 4. Lógica do Gráfico (Agrupamento inteligente)
    const contagem = listaFinal.reduce((acc, item) => {
        acc[item.valor] = (acc[item.valor] || 0) + 1;
        return acc;
    }, {});

    const entradas = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
    const principais = entradas.filter(item => item[1] >= 2);
    const outrosTotal = entradas.filter(item => item[1] < 2).reduce((soma, item) => soma + item[1], 0);

    let dadosFinais = [...principais];
    if (outrosTotal > 0) dadosFinais.push(['Outros', outrosTotal]);

    // 5. Cores e Legendas
    const hexCores = [
        '#10B981', '#3B82F6', '#F59E0B', '#F43F5E', '#8B5CF6', 
        '#06B6D4', '#F97316', '#A3E635', '#EC4899', '#64748B'
    ];    

    // Lógica para garantir que o "Outros" seja SEMPRE cinza (#64748B)
    const coresParaUso = dadosFinais.map((item, index) => {
        if (item[0] === 'Outros') {
            return hexCores[hexCores.length - 1]; // Retorna o cinza
        }
        return hexCores[index % (hexCores.length - 1)]; // Usa as outras cores
    });

    // Atualiza HTML da legenda dinamicamente
    if (containerLegendas) {
        containerLegendas.innerHTML = dadosFinais.map((item, i) => `
            <span class="flex items-center gap-2">
                <i class="w-3 h-3 max-w-3 max-h-3 min-w-3 min-h-3 rounded-full" style="background-color: ${coresParaUso[i]}"></i> 
                <span>${item[0]}</span>
            </span>
        `).join('');
    }

    // 6. Renderiza Gráfico USANDO A COR CALCULADA
    const ctx = mostrarGrafico('donut');
    // const ctx = document.getElementById('meuGraficoDonut').getContext('2d');
    if (window.meuGrafico instanceof Chart) window.meuGrafico.destroy();

    window.meuGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: dadosFinais.map(i => i[0]),
            datasets: [{
                data: dadosFinais.map(i => i[1]),
                backgroundColor: coresParaUso, // <--- AQUI ESTAVA O ERRO (mudamos de hexCores para coresParaUso)
                borderWidth: 0,
                cutout: '75%'
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });

    if (estaBloqueado(coluna)) {
        lista.innerHTML = `
            <tr>
                <td class="text-center text-gray-500">
                    <div class="flex flex-col items-center justify-center h-64">
                        <iconify-icon icon="gg:lock" class="text-5xl mb-4 text-emerald-600 block"></iconify-icon>
                        <p class="font-bold">Palpites Ocultos</p>
                        <p class="text-xs">Será revelado depois...</p>
                    </div>
                </td>
            </tr>`;
    } else {
        // Agrupa os palpites por valor (ex: CR7, Messi, etc.) sem agrupar em "Outros"
        const grupos = listaFinal.reduce((acc, item) => {
            if (!acc[item.valor]) acc[item.valor] = [];
            acc[item.valor].push(item);
            return acc;
        }, {});

        // Ordena para que os times com mais votos apareçam primeiro na lista
        const titulosOrdenados = Object.keys(grupos).sort((a, b) => {
            return grupos[b].length - grupos[a].length;
        });

        // Renderiza a lista completa, mostrando todos os nomes
        lista.innerHTML = titulosOrdenados.map(titulo => {
            return gerarSecaoCriterio(titulo, grupos[titulo]);
        }).join('');
    }

    document.getElementById('modal-loader').classList.add('hidden');
}

async function abrirModalGols(coluna, titulo) {
    const tituloModal = document.querySelector('#modal-apostas h3');
    const lista = document.getElementById('lista-apostas-modal');
    const containerMeuPalpite = document.getElementById('meu-palpite-container');
    const valorMeuPalpite = document.getElementById('meu-palpite-valor');
    
    // 1. UI Inicial
    tituloModal.innerText = titulo;
    document.body.classList.add('modal-aberto');
    document.getElementById('modal-loader').classList.remove('hidden'); 
    document.getElementById('modal-apostas').classList.remove('hidden');
    lista.innerHTML = '<tr><td class="p-4 text-center text-gray-400">Carregando...</td></tr>';
    containerMeuPalpite.classList.add('hidden');
    
    // 2. Mostrar container certo
    document.getElementById('container-grafico-donut').classList.add('hidden');
    document.getElementById('container-grafico-bar').classList.remove('hidden');
    document.getElementById('container-legendas').classList.add('hidden');

    // 3. BUSCA ÚNICA (Resolve o erro do Identifier e melhora performance)
    const userId = (await supabaseClient.auth.getUser()).data.user.id;
    
    const [resPalpites, resUsuarios, resMeuPalpite] = await Promise.all([
        supabaseClient.from('palpites').select(`usuario_id, ${coluna}`),
        supabaseClient.from('usuarios').select('id, nome'),
        supabaseClient.from('palpites').select(coluna).eq('usuario_id', userId).single()
    ]);

    const apostas = resPalpites.data;
    const mapaUsuarios = Object.fromEntries(resUsuarios.data.map(u => [u.id, u.nome]));

    // 4. Preencher Meu Palpite (se existir)
    if (resMeuPalpite.data && resMeuPalpite.data[coluna] !== null) {
        valorMeuPalpite.innerText = resMeuPalpite.data[coluna] + " gol(s)";
        containerMeuPalpite.classList.remove('hidden');
    }

    // 5. Processamento
    const palpitesValidos = apostas.filter(a => a[coluna] !== null);
    const max = Math.max(...palpitesValidos.map(a => a[coluna]), 0);
    
    let dadosFinais = [];
    for (let i = 0; i <= max; i++) {
        const apostasNesteValor = palpitesValidos.filter(a => a[coluna] === i);
        dadosFinais.push({ 
            valor: `${i} gol(s)`, 
            contagem: apostasNesteValor.length,
            lista: apostasNesteValor.map(a => mapaUsuarios[a.usuario_id] || 'Anon')
        });
    }

    // 6. Renderização do Gráfico
    const canvas = document.getElementById('canvas-bar');
    const ctx = canvas.getContext('2d');
    
    if (window.meuGrafico) window.meuGrafico.destroy();

    window.meuGrafico = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dadosFinais.map(d => d.valor),
            datasets: [{
                data: dadosFinais.map(d => d.contagem),
                backgroundColor: '#10B981'
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { beginAtZero: true, ticks: { stepSize: 1 }, title: { display: true, text: 'PALPITES', color: '#9CA3AF', font: { size: 12, weight: 'bold' } } },
                x: { grid: { display: false }, title: { display: true, text: 'GOLS', color: '#9CA3AF', font: { size: 12, weight: 'bold' } }, ticks: { maxRotation: 0, minRotation: 0, callback: function(v) { return this.getLabelForValue(v).split(' ')[0]; } } }
            }
        }
    });

    // 7. Lista final
    if (estaBloqueado(coluna)) {
        lista.innerHTML = `<tr><td class="text-center text-gray-500"><div class="flex flex-col items-center justify-center h-64"><iconify-icon icon="gg:lock" class="text-5xl mb-4 text-emerald-600 block"></iconify-icon><p class="font-bold">Palpites Ocultos</p><p class="text-xs">Será revelado depois...</p></div></td></tr>`;
    } else {
        lista.innerHTML = dadosFinais.filter(d => d.contagem > 0)
            .map(d => gerarSecaoCriterio(d.valor, d.lista.map(n => ({ usuario: n }))))
            .join('');
    }

    document.getElementById('modal-loader').classList.add('hidden');
}

function fecharModal() {
    document.getElementById('modal-apostas').classList.add('hidden');
    document.body.classList.remove('modal-aberto');
    
    // LIMPEZA OBRIGATÓRIA
    document.getElementById('meu-palpite-container').classList.add('hidden');
    document.getElementById('meu-palpite-valor').innerText = '';
}

// btnLogout.addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = "index.html"; });
document.getElementById('btn-salvar').addEventListener('click', salvarPalpites);

btnsLogout.forEach(botao => {
    botao.addEventListener('click', async () => { 
        await supabaseClient.auth.signOut(); 
        window.location.href = "index.html"; 
    });
});

async function iniciarPagina() {
    // 1. Carrega os dados (Isso popula os inputs E os spans)
    await carregarDadosIniciais(); 
    
    // 2. Verifica se o prazo acabou
    const prazoEncerrado = await verificarPrazo();
    
    // 3. Se acabou, esconde os inputs (que já estão com spans preenchidos)
    if (prazoEncerrado) {
        travarInputs();
    }
}

// document.addEventListener('DOMContentLoaded', iniciarPagina);
document.addEventListener('DOMContentLoaded', () => {
    carregarSaudacao();
    iniciarPagina();
});

document.querySelectorAll('.ver-apostas').forEach(btn => {
    btn.addEventListener('click', () => {
        const coluna = btn.getAttribute('data-coluna');
        const titulo = btn.getAttribute('data-titulo') || "Apostas";
        const tipo = btn.getAttribute('data-tipo') || "jogadores";
        
        // A LÓGICA DE ROTEAMENTO:
        if (tipo === 'gols_pro' || tipo === 'gols_contra') {
            abrirModalGols(coluna, titulo);
        } else {
            abrirModalCriterio(coluna, titulo, tipo);
        }
    });
});

document.getElementById('modal-apostas').addEventListener('click', (e) => {
    // Se o elemento clicado for o fundo (e não o conteúdo interno), fecha
    if (e.target.id === 'modal-apostas') {
        fecharModal();
    }
});

document.getElementById('btn-fechar-modal').addEventListener('click', fecharModal);
window.fecharModal = fecharModal;