/**
 * palpites.js - Motor Completo de Palpites
 */
import { RegrasExtras } from './regras-extras.js';

const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const saudacaoUser = document.getElementById('saudacao-user');
const btnLogout = document.getElementById('btn-logout');
const toast = document.getElementById('toast');

let configRegras = [];
let gabaritoGlobal = null;

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Carrega dados essenciais para os selects e regras
    const [ { data: regras }, { data: gab }, { data: jogadores }, { data: fases }, { data: paises } ] = await Promise.all([
        supabaseClient.from('pontuacao').select('*'),
        supabaseClient.from('resultados').select('*').single(),
        supabaseClient.from('jogadores').select('id, nome, clube').order('nome'),
        supabaseClient.from('fases').select('id, nome'),
        supabaseClient.from('paises').select('id, nome').order('nome')
    ]);

    configRegras = regras || [];
    gabaritoGlobal = gab;

    // 2. Popula os selects
    popularSelect('sel-gol', jogadores, (j) => `${j.nome} (${j.clube})`);
    popularSelect('sel-fase', fases, (f) => f.nome);
    const pSel = ['sel-campeao', 'sel-vice', 'sel-terceiro', 'sel-quarto', 'sel-pior', 'sel-artilheiro-pais'];
    pSel.forEach(id => popularSelect(id, paises, (p) => p.nome));

    // 3. Carrega os palpites do usuário e calcula pontos
    await carregarPalpitesEComparar();

    // 4. Listeners para cálculo em tempo real
    document.getElementById('inp-total-gols').addEventListener('input', calcularBonusTotalGols);
    document.getElementById('btn-salvar-palpites').addEventListener('click', salvarPalpites);
    btnLogout.addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = 'index.html'; });
});

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

function calcularBonusTotalGols() {
    const val = document.getElementById('inp-total-gols').value;
    const palpiteGols = parseInt(val) || 0;
    const gabGols = parseInt(gabaritoGlobal?.total_gols) || 0;
    const pontosBase = RegrasExtras.obterPontos('ALLGOLS', configRegras);
    
    // Calcula usando a lógica híbrida (Bônus se cravar / Penalidade pela diferença)
    const pts = RegrasExtras.calcularTotalGols(palpiteGols, gabGols, pontosBase);
    
    const el = document.getElementById('pts-total-gols');
    if (el) {
        el.textContent = `${pts >= 0 ? '+' : ''}${pts} pts`;
        el.className = `block text-[10px] font-bold mt-1 ${pts >= 0 ? 'text-emerald-400' : 'text-red-500'}`;
    }
}

async function carregarPalpitesEComparar() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data: p } = await supabaseClient.from('palpites').select('*').eq('usuario_id', user.id).single();
    const { data: u } = await supabaseClient.from('usuarios').select('nome').eq('id', user.id).single();
    
    if (u) saudacaoUser.innerText = `Olá, ${u.nome}!`;
    
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
        
        // Dispara o cálculo de todos os campos
        if (gabaritoGlobal) exibirPontos(p, gabaritoGlobal);
    }
}

function exibirPontos(palpite, gabarito) {
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
        const pontosBase = RegrasExtras.obterPontos(item.pts, configRegras);
        let pontos = 0;
        if (item.tipo === 'simples') pontos = RegrasExtras.calcularSimples(item.p, item.g, pontosBase);
        else if (item.tipo === 'duelo') pontos = RegrasExtras.calcularDueloGigantes(item.p, item.g, pontosBase);
        else if (item.tipo === 'total') pontos = RegrasExtras.calcularTotalGols(item.p, item.g, pontosBase);
        
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

function showToast(m, e = false) {
    toast.innerText = m;
    toast.className = `fixed bottom-5 right-5 text-white px-5 py-3 rounded-lg shadow-xl font-medium transition ${e ? 'bg-red-600' : 'bg-emerald-600'}`;
    setTimeout(() => toast.classList.add('opacity-0'), 3000);
}