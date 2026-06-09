/**
 * palpites.js - Motor Completo e Estável (Versão Final)
 */
import { RegrasExtras } from './regras-extras.js';

const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const saudacaoUser = document.getElementById('saudacao-user');
const btnLogout = document.getElementById('btn-logout');
const toast = document.getElementById('toast');

let configRegras = [];
let listaFases = [];
let todosJogos = [];
let gabaritoGlobal = null;

function showToast(mensagem, isError = false) {
    toast.innerText = mensagem;
    toast.className = `fixed bottom-5 right-5 text-white px-5 py-3 rounded-lg shadow-xl font-medium translate-y-0 opacity-100 transition-all duration-300 ${isError ? 'bg-red-600' : 'bg-emerald-600'}`;
    setTimeout(() => { toast.className = "fixed bottom-5 right-5 text-white px-5 py-3 rounded-lg shadow-xl font-medium translate-y-20 opacity-0 transition-all duration-300"; }, 3000);
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
        item.textContent = `${regra.pontos} pts - Seu campeão perdeu a final`;
    } else {
        item.textContent = `${regra.pontos} pts - Seu campeão foi eliminado na ${nomeFase}`;
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
        supabaseClient.from('jogadores').select('id, nome, clube').order('nome'),
        supabaseClient.from('fases').select('id, nome, codigo_regra'),
        supabaseClient.from('paises').select('id, nome').order('nome'),
        supabaseClient.from('usuarios').select('nome').eq('id', session.user.id).single(),
        supabaseClient.from('jogos').select('fase_id, time_a_id, time_b_id, vencedor_final_id')
    ]);

    configRegras = regras.data || [];
    gabaritoGlobal = gab.data;
    listaFases = fases.data || [];
    todosJogos = jogos.data || [];
    
    if (userData.data) saudacaoUser.innerText = `Olá, ${userData.data.nome}! Preencha seus palpites.`;

    popularSelect('sel-gol', jogadores.data, (j) => `${j.nome} (${j.clube})`);
    popularSelect('sel-fase', fases.data, (f) => f.nome);
    ['sel-campeao', 'sel-vice', 'sel-terceiro', 'sel-quarto', 'sel-pior', 'sel-artilheiro-pais'].forEach(id => popularSelect(id, paises.data, (p) => p.nome));
    
    carregarPalpitesEComparar();
}

function popularSelect(id, dados, formatter) {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '<option value="">Selecione...</option>';
    if (dados) dados.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = formatter(item);
        select.appendChild(option);
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
        document.getElementById('inp-total-gols').value = p.total_gols || 0;

        if (gabaritoGlobal) {
            document.getElementById('box-bonus').classList.remove('hidden');
            exibirPontos(p, gabaritoGlobal);
            verificarPenalidadeCampeao(p.campeao_id);
        }
    }
}

function exibirPontos(palpite, gabarito) {
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
        { id: 'pts-total-gols', p: palpite.total_gols, g: gabarito.total_gols, pts: 'ALLGOLS', tipo: 'total' }
    ];

    map.forEach(item => {
        const pBase = RegrasExtras.obterPontos(item.pts, configRegras);
        let pontos = 0;
        if (item.tipo === 'simples') pontos = RegrasExtras.calcularSimples(extrair(item.p), extrair(item.g), pBase);
        else if (item.tipo === 'duelo') pontos = RegrasExtras.calcularDueloGigantes(item.p, item.g, pBase);
        else if (item.tipo === 'total') pontos = RegrasExtras.calcularTotalGols(item.p, item.g, pBase);
        
        const el = document.getElementById(item.id);
        if (el) {
            el.textContent = `${pontos >= 0 ? '+' : ''}${pontos} pts`;
            el.className = `block text-[10px] font-bold mt-1 ${pontos >= 0 ? 'text-emerald-400' : 'text-red-500'}`;
        }
    });
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
        duelo_gigantes: document.getElementById('sel-cr7-messi').value,
        total_gols: parseInt(document.getElementById('inp-total-gols').value) || 0
    };

    const { error } = await supabaseClient.from('palpites').upsert(dados, { onConflict: 'usuario_id' });
    if (error) showToast("Erro: " + error.message, true);
    else showToast("Palpites salvos com sucesso!");
}

btnLogout.addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = "index.html"; });
document.getElementById('btn-salvar-palpites').addEventListener('click', salvarPalpites);
document.addEventListener('DOMContentLoaded', carregarDadosIniciais);