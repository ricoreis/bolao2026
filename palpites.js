/**
 * palpites.js - Motor Completo e Corrigido
 */
import { RegrasExtras } from './regras-extras.js';

const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const saudacaoUser = document.getElementById('saudacao-user');
const btnLogout = document.getElementById('btn-logout');
const toast = document.getElementById('toast');

let configRegras = [];

function showToast(mensagem, isError = false) {
    toast.innerText = mensagem;
    toast.className = `fixed bottom-5 right-5 text-white px-5 py-3 rounded-lg shadow-xl font-medium translate-y-0 opacity-100 transition-all duration-300 ${isError ? 'bg-red-600' : 'bg-emerald-600'}`;
    setTimeout(() => { toast.className = "fixed bottom-5 right-5 text-white px-5 py-3 rounded-lg shadow-xl font-medium translate-y-20 opacity-0 transition-all duration-300"; }, 3000);
}

async function carregarDadosIniciais() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }

    const [regras, jogadores, fases, paises, userData] = await Promise.all([
        supabaseClient.from('pontuacao').select('*'),
        supabaseClient.from('jogadores').select('id, nome, clube').order('nome'),
        supabaseClient.from('fases').select('id, nome'),
        supabaseClient.from('paises').select('id, nome').order('nome'),
        supabaseClient.from('usuarios').select('nome').eq('id', session.user.id).single()
    ]);

    configRegras = regras.data || [];
    if (userData.data) saudacaoUser.innerText = `Olá, ${userData.data.nome}! Preencha seus palpites.`;

    popularSelect('sel-gol', jogadores.data, (j) => `${j.nome} (${j.clube})`);
    popularSelect('sel-fase', fases.data, (f) => f.nome);
    const paisesSelects = ['sel-campeao', 'sel-vice', 'sel-terceiro', 'sel-quarto', 'sel-pior', 'sel-artilheiro-pais'];
    paisesSelects.forEach(id => popularSelect(id, paises.data, (p) => p.nome));
    
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
    
    const [p, g] = await Promise.all([
        supabaseClient.from('palpites').select('*').eq('usuario_id', user.id).single(),
        supabaseClient.from('resultados').select('*').eq('id', 1).single()
    ]);
    
    if (p.data) {
        document.getElementById('sel-gol').value = p.data.primeiro_gol_brasil_id || '';
        document.getElementById('sel-fase').value = p.data.fase_brasil_id || '';
        document.getElementById('sel-campeao').value = p.data.campeao_id || '';
        document.getElementById('sel-vice').value = p.data.vice_id || '';
        document.getElementById('sel-terceiro').value = p.data.terceiro_id || '';
        document.getElementById('sel-quarto').value = p.data.quarto_id || '';
        document.getElementById('sel-pior').value = p.data.pior_time_id || '';
        document.getElementById('sel-artilheiro-pais').value = p.data.artilheiro_pais_id || '';
        document.getElementById('inp-gols-pro').value = p.data.gols_feitos_brasil || 0;
        document.getElementById('inp-gols-contra').value = p.data.gols_sofridos_brasil || 0;
        document.getElementById('sel-cr7-messi').value = p.data.duelo_gigantes || '';
        document.getElementById('inp-total-gols').value = p.data.total_gols || 0;

        if (g.data) {
            document.getElementById('box-bonus').classList.remove('hidden');
            exibirPontos(p.data, g.data);
        }
    }
}

function exibirPontos(palpite, gabarito) {
    const extrair = (val) => (val && typeof val === 'object' && 'id' in val) ? parseInt(val.id) : parseInt(val);

    const map = [
        { id: 'pts-gol-brasil', p: palpite.primeiro_gol_brasil_id, g: gabarito.primeiro_gol_brasil_id, pts: RegrasExtras.obterPontos('BRGOL', configRegras), tipo: 'simples' },
        { id: 'pts-fase-brasil', p: palpite.fase_brasil_id, g: gabarito.fase_brasil_id, pts: RegrasExtras.obterPontos('BRFASE', configRegras), tipo: 'simples' },
        { id: 'pts-gols-pro', p: palpite.gols_feitos_brasil, g: gabarito.gols_feitos_brasil, pts: RegrasExtras.obterPontos('BRG+', configRegras), tipo: 'simples' },
        { id: 'pts-gols-contra', p: palpite.gols_sofridos_brasil, g: gabarito.gols_sofridos_brasil, pts: RegrasExtras.obterPontos('BRG-', configRegras), tipo: 'simples' },
        { id: 'pts-artilheiro', p: palpite.artilheiro_pais_id, g: gabarito.artilheiro_pais_id, pts: RegrasExtras.obterPontos('ARTILH', configRegras), tipo: 'simples' },
        { id: 'pts-campeao', p: palpite.campeao_id, g: gabarito.campeao_id, pts: RegrasExtras.obterPontos('CAMP', configRegras), tipo: 'simples' },
        { id: 'pts-vice', p: palpite.vice_id, g: gabarito.vice_id, pts: RegrasExtras.obterPontos('VICE', configRegras), tipo: 'simples' },
        { id: 'pts-terceiro', p: palpite.terceiro_id, g: gabarito.terceiro_id, pts: RegrasExtras.obterPontos('TERC', configRegras), tipo: 'simples' },
        { id: 'pts-quarto', p: palpite.quarto_id, g: gabarito.quarto_id, pts: RegrasExtras.obterPontos('QUAR', configRegras), tipo: 'simples' },
        { id: 'pts-pior', p: palpite.pior_time_id, g: gabarito.pior_time_id, pts: RegrasExtras.obterPontos('PIOR', configRegras), tipo: 'simples' },
        { id: 'pts-cr7-messi', p: palpite.duelo_gigantes, g: gabarito.duelo_gigantes, pts: RegrasExtras.obterPontos('CR7M10', configRegras), tipo: 'duelo' },
        { id: 'pts-total-gols', p: palpite.total_gols, g: gabarito.total_gols, pts: RegrasExtras.obterPontos('ALLGOLS', configRegras), tipo: 'total' }
    ];

    map.forEach(item => {
        let pontos = 0;
        if (item.tipo === 'simples') pontos = RegrasExtras.calcularSimples(extrair(item.p), extrair(item.g), item.pts);
        else if (item.tipo === 'duelo') pontos = RegrasExtras.calcularDueloGigantes(item.p, item.g, item.pts);
        else if (item.tipo === 'total') pontos = RegrasExtras.calcularTotalGols(item.p, item.g, item.pts);
        
        const el = document.getElementById(item.id);
        if (el) el.textContent = `+${pontos} pts`;
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
    if (error) showToast("Erro ao salvar: " + error.message, true);
    else showToast("Palpites salvos com sucesso!");
}

btnLogout.addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = "index.html"; });
document.getElementById('btn-salvar-palpites').addEventListener('click', salvarPalpites);
document.addEventListener('DOMContentLoaded', carregarDadosIniciais);