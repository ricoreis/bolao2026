/**
 * palpites.js - Motor Completo e Estável (Versão Final)
 */
import { RegrasExtras } from './regras-extras.js';

const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// const btnLogout = document.getElementById('btn-logout');
const btnsLogout = document.querySelectorAll('.btn-logout');
const toast = document.getElementById('toast');

let configRegras = [];
let listaFases = [];
let todosJogos = [];
let gabaritoGlobal = null;

function showToast(mensagem) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = mensagem;
        
        // POSICIONAMENTO: top-5, right-5
        // ANIMAÇÃO: translate-y-[-20px] para surgir de cima (negativo)
        toast.className = "fixed top-5 right-5 z-[60] text-white px-5 py-3 rounded-lg shadow-xl font-medium bg-emerald-600 transition-all duration-300 opacity-100 translate-y-0";
        
        setTimeout(() => {
            // Ao esconder: volta para cima (translate-y-[-20px]) e opacidade 0
            toast.className = "fixed top-5 right-5 z-[60] text-white px-5 py-3 rounded-lg shadow-xl font-medium bg-emerald-600 transition-all duration-300 translate-y-[-20px] opacity-0";
        }, 3000);
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
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }

    const [regras, gab, jogadores, fases, paises, userData, jogos] = await Promise.all([
        supabaseClient.from('pontuacao').select('*'),
        supabaseClient.from('resultados').select('*').eq('id', 1).single(),
        supabaseClient.from('jogadores').select('id, nome, clube, posicao').order('nome'),
        supabaseClient.from('fases').select('id, nome, codigo_regra').order('id'),
        supabaseClient.from('paises').select('id, nome').order('nome'),
        supabaseClient.from('usuarios').select('nome').eq('id', session.user.id).single(),
        supabaseClient.from('jogos').select('fase_id, time_a_id, time_b_id, vencedor_final_id')
    ]);

    configRegras = regras.data || [];
    gabaritoGlobal = gab.data;
    listaFases = fases.data || [];
    todosJogos = jogos.data || [];
    
    popularSelect('sel-fase', fases.data, (f) => f.nome);
    ['sel-campeao', 'sel-vice', 'sel-terceiro', 'sel-quarto', 'sel-pior', 'sel-artilheiro-pais'].forEach(id => popularSelect(id, paises.data, (p) => p.nome));
    popularSelect('sel-fase', fases.data, (f) => f.nome, 5);

    popularSelectAgrupado('sel-gol', jogadores.data);
    
    ['sel-campeao', 'sel-vice', 'sel-terceiro', 'sel-quarto'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', validarSelecoesClassificacao);
    });

    // configurarValidacaoSelecoes();
    carregarPalpitesEComparar();
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

async function carregarPalpitesEComparar() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data: p } = await supabaseClient.from('palpites').select('*').eq('usuario_id', user.id).single();
    
    if (p) {
        document.getElementById('sel-gol').value = p.primeiro_gol_brasil_id || '';
        document.getElementById('sel-fase').value = p.fase_brasil_id || '';
        document.getElementById('sel-campeao').value = p.campeao_id || '';
        document.getElementById('sel-vice').value = p.vice_id || '';
        document.getElementById('sel-terceiro').value = p.terceiro_id || '';
        document.getElementById('sel-quarto').value = p.quarto_id || '';
        document.getElementById('sel-pior').value = p.pior_time_id || '';
        document.getElementById('sel-artilheiro-pais').value = p.artilheiro_pais_id || '';
        document.getElementById('inp-gols-pro').value = p.gols_feitos_brasil || 0;
        document.getElementById('inp-gols-contra').value = p.gols_sofridos_brasil || 0;
        document.getElementById('sel-cr7-messi').value = p.duelo_gigantes || '';

        const totalGolsCalculado = await calcularTotalGolsReal(user.id);
        const totalGolsOficial = await calcularTotalGolsOficial(); // <--- NOVA CHAMADA
        
        // Se quiser exibir no input para o usuário ver (mas desabilitado):
        const inputGols = document.getElementById('inp-total-gols');
        inputGols.value = totalGolsCalculado;
        inputGols.disabled = true; // Assim o usuário sabe que é automático

        if (gabaritoGlobal) {
            document.getElementById('box-bonus').classList.remove('hidden');
            exibirPontos(p, gabaritoGlobal, totalGolsCalculado, totalGolsOficial);
            verificarPenalidadeCampeao(p.campeao_id);
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
                console.log(pontos + "");
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

    // 1. O Supabase sempre retorna data em ISO string (formato UTC)
    // Ao usar new Date(jogo.data_jogo), o JS cria o objeto de data corretamente
    const dataJogo = new Date(jogo.data_jogo); 
    const agora = new Date();

    // 2. getTime() retorna o número de milissegundos desde 1970 em UTC.
    // Isso é universal, não importa onde o usuário esteja!
    const tempoJogo = dataJogo.getTime();
    const tempoAgora = agora.getTime();
    
    // Duas horas em milissegundos
    const duasHorasEmMs = 2 * 60 * 60 * 1000;

    // 3. A comparação agora é matemática pura, sem fuso horário envolvido
    if ((tempoJogo - tempoAgora) < duasHorasEmMs) {
        travarInputs();
        showToast("Apostas encerradas!");
    }
}

function travarInputs() {
    const inputs = document.querySelectorAll('.grp-input');
    const btnSalvar = document.getElementById('btn-salvar-palpites');
    
    inputs.forEach(i => i.disabled = true);
    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.classList.add('bg-transparent', 'cursor-not-allowed');
        btnSalvar.classList.remove('bg-emerald-600', 'hover:bg-emerald-700', 'font-bold' );
        btnSalvar.textContent = "Apostas de Palpites Encerradas";
        instrucoes.classList.add('hidden');
    }
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
    else showToast("Palpites salvos com sucesso!");
}

function validarSelecoesClassificacao() {
    const ids = ['sel-campeao', 'sel-vice', 'sel-terceiro', 'sel-quarto'];
    const selects = ids.map(id => document.getElementById(id));
    const spanErro = document.getElementById('erro-classificacao'); // Agora vai achar!
    const btnSalvar = document.getElementById('btn-salvar-palpites');
    
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

// btnLogout.addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = "index.html"; });
document.getElementById('btn-salvar-palpites').addEventListener('click', salvarPalpites);

btnsLogout.forEach(botao => {
    botao.addEventListener('click', async () => { 
        await supabaseClient.auth.signOut(); 
        window.location.href = "index.html"; 
    });
});

async function iniciarPagina() {
    await carregarDadosIniciais();
    await verificarPrazo();
}

// document.addEventListener('DOMContentLoaded', iniciarPagina);
document.addEventListener('DOMContentLoaded', () => {
    carregarSaudacao();
    iniciarPagina();
});