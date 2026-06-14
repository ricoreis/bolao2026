import { supabaseClient } from './supabase-config.js';
import { carregarSaudacao } from './auth-header.js';

// Variável global para armazenar as regras do banco
let configRegras = [];

// const btnLogout = document.getElementById('btn-logout');
const btnsLogout = document.querySelectorAll('.btn-logout');
const toast = document.getElementById('toast');

// Carrega as regras do banco ao iniciar o bolão
async function carregarRegras() {
    const { data } = await supabaseClient.from('pontuacao').select('*');
    if (data) configRegras = data;
}

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

async function verificarSessao() {
    await carregarRegras(); 
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }
    
    const { data: userData } = await supabaseClient.from('usuarios').select('nome').eq('id', session.user.id).single();
    carregarJogosEApostas();
}

async function carregarJogosEApostas() {
    // 1. Obtém as referências dos elementos
    const loader = document.getElementById('loader');
    const jogosContainer = document.getElementById('jogos-container'); // Ajuste o ID conforme o seu HTML

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return;

        const ehPaginaFinais = window.location.pathname.includes('apostas-finais.html');

        let query = supabaseClient
            .from('jogos')
            .select(`
                *,
                fase:fases(nome),
                time_a:paises!jogos_time_a_id_fkey(nome, sigla, id),
                time_b:paises!jogos_time_b_id_fkey(nome, sigla, id)
            `);

        if (ehPaginaFinais) {
            query = query.gt('fase_id', 1).order('fase_id', { ascending: true }).order('data_jogo', { ascending: true });
        } else {
            query = query.eq('fase_id', 1).order('data_jogo', { ascending: true });
        }

        const tempoMinimo = new Promise(resolve => setTimeout(resolve, 3000));

        // Usando Promise.all para carregar tudo de uma vez, igual ao ranking
        const [ {data: jogos, error: erroJogos}, {data: apostas} ] = await Promise.all([
            query,
            supabaseClient.from('apostas').select('*').eq('usuario_id', session.user.id),
            tempoMinimo
        ]);

        if (erroJogos) throw erroJogos;

        const mapaApostas = {};
        if (apostas) apostas.forEach(p => mapaApostas[p.jogo_id] = p);

        // 2. Renderiza
        renderizarJogos(jogos, mapaApostas, ehPaginaFinais);
        
        // 3. Sucesso: esconde o loader e mostra o conteúdo
        if (loader) loader.classList.add('hidden');
        if (jogosContainer) jogosContainer.classList.remove('hidden');

        setTimeout(rolarParaUltimoResultado, 500);

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
    }
}

function renderizarJogos(jogos, mapaApostas, ehPaginaFinais) {
    const container = document.getElementById('container-jogos');
    const template = document.getElementById('template-jogo');
    if (!container || !template) return;
    container.innerHTML = ''; 

    let faseAtualRegistrada = "";

    jogos.forEach(jogo => {
        if (ehPaginaFinais && jogo.fase?.nome !== faseAtualRegistrada) {
            faseAtualRegistrada = jogo.fase?.nome;
            const header = document.createElement('h3');
            header.className = "text-sm font-bold uppercase tracking-wider text-emerald-400 bg-gray-800/30 border border-gray-700/40 px-4 py-2.5 rounded-lg mt-6 mb-3 w-full";
            header.innerText = faseAtualRegistrada || "Mata-Mata";
            container.appendChild(header);
        }

        const aposta = mapaApostas ? mapaApostas[jogo.id] : null;
        const card = template.content.cloneNode(true);
        const cardElement = card.querySelector('.card-jogo');

        const dataLocal = new Date(jogo.data_jogo);
        const agora = new Date();
        const faltamMenosDeUmaHora = (dataLocal - agora) / (1000 * 60) < 60;
        const jogoOcorrido = (jogo.gols_a !== null && jogo.gols_b !== null);

        let jogoPrefixo = "";
        if(jogo.jogo_fifa) {
            jogoPrefixo = "JOGO " + jogo.jogo_fifa + " - "
        } else {
            jogoPrefixo = "GRUPO " + jogo.grupo + " - ";
        }

        const ehUltimoComResultado = jogoOcorrido && (jogos.filter(j => j.gols_a !== null && j.gols_b !== null).pop() === jogo);
        if (ehUltimoComResultado) {
            cardElement.id = "ultimo-placar-oficial";
        }

        card.querySelector('.data-jogo').innerText = jogoPrefixo + dataLocal.toLocaleString('pt-BR', {
            weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        }).replace(' ', '').replace(',', ' ').replace(', ', ' ').toUpperCase();

        card.querySelector('.time-a').innerText = jogo.time_a?.nome || jogo.time_a_placeholder || 'A definir';
        card.querySelector('.time-b').innerText = jogo.time_b?.nome || jogo.time_b_placeholder || 'A definir';
        card.querySelector('.sigla-a').innerText = jogo.time_a?.sigla || jogo.time_a_placeholder || 'A definir';
        card.querySelector('.sigla-b').innerText = jogo.time_b?.sigla || jogo.time_b_placeholder || 'A definir';

        if (jogo.time_a?.id) {
            card.querySelector('.band-a').src = `./assets/images/paises/${jogo.time_a?.id}.svg`;
            card.querySelector('.band-a').setAttribute("title", jogo.time_a?.nome);
        }
        if (jogo.time_b?.id) {
            card.querySelector('.band-b').src = `./assets/images/paises/${jogo.time_b?.id}.svg`;
            card.querySelector('.band-b').setAttribute("title", jogo.time_b?.nome);
        }

        const inputA = card.querySelector('.input-a');
        const inputB = card.querySelector('.input-b');
        const definitivoA = card.querySelector('.definitivo-a');
        const definitivoB = card.querySelector('.definitivo-b');
        const btnSalvar = card.querySelector('.btn-salvar');
        const statusBadge = card.querySelector('.status-badge');
        const btnVerApostas = card.querySelector('.ver-apostas');

        inputA.id = `golsA_${jogo.id}`;
        inputB.id = `golsB_${jogo.id}`;
        inputA.value = aposta?.gols_a ?? '';
        inputB.value = aposta?.gols_b ?? '';

        definitivoA.textContent = inputA.value;
        definitivoB.textContent = inputB.value;

        const toggleSalvar = () => {
            const preenchidoA = inputA.value !== '';
            const preenchidoB = inputB.value !== '';
            
            definitivoA.textContent = inputA.value;
            definitivoB.textContent = inputB.value;

            if (preenchidoA && preenchidoB) {
                btnSalvar.classList.remove("hidden");
            } else {
                btnSalvar.classList.add("hidden");
            }
        };
        inputA.addEventListener('input', toggleSalvar);
        inputB.addEventListener('input', toggleSalvar);

        // Cálculo dinâmico com Multiplicador
        if (jogo.gols_a !== null && jogo.gols_b !== null && aposta) {
            // Se fase_id > 1 (Mata-mata), multiplicador é 2, senão é 1
            const multiplicador = (jogo.fase_id > 1) ? 2 : 1;
            
            const resultado = calcularPontos(aposta.gols_a, aposta.gols_b, jogo.gols_a, jogo.gols_b, configRegras, aposta.penaltis_vencedor_id, jogo.penaltis_vencedor_id, multiplicador);
            const pontos = resultado.total; // Pega apenas o número para exibir            
            
            const divInfo = document.createElement('div');
            divInfo.className = "p-2 bg-gray-900/50 rounded-full text-center text-xs flex flex-row gap-2 items-center justify-center mt-1.5";
            divInfo.innerHTML = `
                <div class="text-gray-400">Placar Oficial: ${jogo.gols_a} x ${jogo.gols_b}</div>
                <div class="text-sm text-gray-800 ${pontos > 0 ? "bg-amber-400" : "bg-red-400"} rounded-full px-2 py-1 w-fit">${pontos > 0 ? "+" : ""}${pontos}</div>
            `;
            // ${multiplicador > 1 ? '<span class="text-xs font-bold text-amber-500 uppercase bg-amber-500/10 px-4 py-2 rounded-full">Dobrado</span>' : ''}
            cardElement.appendChild(divInfo);
        }

        if (jogoOcorrido) {
            inputA.disabled = true; inputB.disabled = true; btnSalvar.disabled = true;
            inputA.classList.add("hidden"); inputB.classList.add("hidden");
            definitivoA.classList.remove("hidden"); definitivoB.classList.remove("hidden");
            statusBadge.classList.add("hidden");
            btnVerApostas.classList.remove("hidden"); // MOSTRA O BOTÃO
            btnVerApostas.onclick = () => abrirModal(jogo.id, jogo.time_a.nome, jogo.time_b.nome);
        } 
        else if ((dataLocal - agora) / (1000 * 60) < 60) {
            inputA.disabled = true; inputB.disabled = true; btnSalvar.disabled = true;
            inputA.classList.add("opacity-50", "cursor-not-allowed", "hidden");
            inputB.classList.add("opacity-50", "cursor-not-allowed", "hidden");
            definitivoA.classList.remove("hidden"); definitivoB.classList.remove("hidden");
            
            btnSalvar.classList.add("hidden");
            statusBadge.classList.remove("hidden");
            statusBadge.innerText = "Apostas Encerradas! Aguardando resultado";
            btnVerApostas.classList.remove("hidden"); // MOSTRA O BOTÃO
            btnVerApostas.onclick = () => abrirModal(jogo.id, jogo.time_a.nome, jogo.time_b.nome);
        } 
        else if (!jogo.time_a || !jogo.time_b) {
            if (jogo.fase_id > 1) {
                statusBadge.classList.remove("hidden");
                inputA.classList.add("hidden");
                inputB.classList.add("hidden");
            } else {
                statusBadge.classList.add("hidden");
            }
            inputA.disabled = true; inputB.disabled = true; btnSalvar.disabled = true;
            inputA.classList.add("opacity-0", "cursor-auto");
            inputB.classList.add("opacity-0", "cursor-auto");
            btnSalvar.classList.add("hidden");
        } 
        else {
            statusBadge.classList.add("hidden");
            btnSalvar.onclick = (e) => salvarAposta(jogo.id, cardElement, ehPaginaFinais);
        }

        // --- Lógica de Pênaltis ---
        const containerPenaltis = card.querySelector('.container-penaltis');
        if (containerPenaltis && ehPaginaFinais && jogo.fase_id > 1) {
            const radioA = card.querySelector('.radio-penaltis-a');
            const radioB = card.querySelector('.radio-penaltis-b');

            // Se o jogo já ocorreu (tem resultado oficial)
            if (jogo.gols_a !== null && jogo.gols_b !== null) {
                // Esconde os inputs de aposta
                containerPenaltis.classList.add('hidden');
                
                const divResultado = document.createElement('div');
                divResultado.className = "mt-2 p-2 bg-gray-800 rounded text-center text-xs";

            let mensagemHTML = "";

            if (jogo.penaltis_vencedor_id) {
                const timeVencedor = (jogo.penaltis_vencedor_id === jogo.time_a_id) ? jogo.time_a.nome : jogo.time_b.nome;
                const acertou = aposta?.penaltis_vencedor_id === jogo.penaltis_vencedor_id;
                
                mensagemHTML = acertou 
                    ? `<span class="text-gray-400">Você acertou: ${timeVencedor} venceu nos pênaltis!</span>`
                    : `<span class="text-red-400">Você apostou em pênaltis, mas não acertou o vencedor.</span>`;
            } else if (aposta?.penaltis_vencedor_id) {
                // mensagemHTML = `<span class="text-gray-400 italic">Você apostou em pênaltis, mas o jogo foi decidido no tempo normal.</span>`;
            }

            // 2. Só cria e adiciona a div SE houver mensagem
            if (mensagemHTML !== "") {
                const divResultado = document.createElement('div');
                divResultado.className = "mt-2 p-2 rounded text-center text-xs";
                divResultado.innerHTML = mensagemHTML;
                cardElement.appendChild(divResultado);
            }

            // cardElement.appendChild(divResultado);

            } else {
                // Jogo ainda não ocorreu: mostra os rádios para apostar
                card.querySelector('.nome-time-a').innerText = jogo.time_a?.nome || 'Time A';
                card.querySelector('.nome-time-b').innerText = jogo.time_b?.nome || 'Time B';

                // Lógica de mostrar apenas se houver empate
                const checkEmpate = () => {
                    const vA = parseInt(inputA.value);
                    const vB = parseInt(inputB.value);
                    if (!isNaN(vA) && !isNaN(vB) && vA === vB) {
                        containerPenaltis.classList.remove('hidden');
                    } else {
                        containerPenaltis.classList.add('hidden');
                    }
                };
                inputA.addEventListener('input', checkEmpate);
                inputB.addEventListener('input', checkEmpate);
                checkEmpate();
            }
        }

        container.appendChild(card);
    });
}

async function salvarAposta(jogoId, cardElement, ehPaginaFinais) {
    const inputA = cardElement.querySelector('.input-a');
    const inputB = cardElement.querySelector('.input-b');
    const btnSalvar = cardElement.querySelector('.btn-salvar');

    const atualizarVisibilidadeBotao = () => {
        const preenchidoA = inputA.value !== '';
        const preenchidoB = inputB.value !== '';

        if (preenchidoA && preenchidoB) {
            btnSalvar.disabled = false;
            btnSalvar.classList.remove('hidden');
        } else {
            btnSalvar.classList.add('hidden');
        }
    };

    inputA.addEventListener('input', atualizarVisibilidadeBotao);
    inputB.addEventListener('input', atualizarVisibilidadeBotao);

    // 2. Estado de Carregamento
    const textoOriginal = btnSalvar.innerHTML;
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = `<span class="opacity-70">Salvando...</span>`;

    inputA.disabled = true;
    inputB.disabled = true;

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const golsA = parseInt(inputA.value);
        const golsB = parseInt(inputB.value);

        const dadosAposta = { 
            usuario_id: user.id, 
            jogo_id: jogoId, 
            gols_a: golsA, 
            gols_b: golsB 
        };

        if (ehPaginaFinais) {
            const ehEmpate = (golsA === golsB);
            if (ehEmpate) {
                const radio = cardElement.querySelector(`input[name="penaltis_${jogoId}"]:checked`);
                dadosAposta.penaltis_vencedor_id = radio ? parseInt(radio.value) : null;
            } else {
                dadosAposta.penaltis_vencedor_id = null;
            }
        }
        
        btnSalvar.innerHTML = `<span class="text-emerald-400 font-bold">Aposta salva!</span>`;
        btnSalvar.classList.add('bg-emerald-900/20', 'border-emerald-700');
        btnSalvar.classList.remove('hover:bg-emerald-700');

        const { error } = await supabaseClient
            .from('apostas')
            .upsert(dadosAposta, { onConflict: 'usuario_id, jogo_id' });
        
        if (error) {
            console.error("Erro Supabase:", error);
            showToast("Erro ao salvar.", true);
        } else {
            showToast("Aposta salva!");
        }

        setTimeout(() => {
            btnSalvar.classList.add('hidden'); 
            btnSalvar.innerHTML = textoOriginal;
            btnSalvar.classList.remove('bg-emerald-900/20', 'border-emerald-700');
            btnSalvar.classList.add('hover:bg-emerald-700');
            inputA.disabled = false;
            inputB.disabled = false;
            // Opcional: btnSalvar.disabled = false; // Não precisa, o hidden já bloqueia
        }, 3000);
    } catch (e) { 
        console.error(e);
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = textoOriginal; 
        btnSalvar.classList.remove('bg-emerald-900/20', 'border-emerald-700');
        btnSalvar.classList.add('hover:bg-emerald-700');
        inputA.disabled = false;
        inputB.disabled = false;
        showToast("Erro ao processar.", true); 
    } finally {
        // btnSalvar.disabled = false;
        // btnSalvar.innerHTML = textoOriginal;
    }
}

async function abrirModal(jogoId, nomeA, nomeB) {
    const lista = document.getElementById('lista-apostas-modal');
    const tituloModal = document.querySelector('#modal-apostas h3');
    const containerMeuPalpite = document.getElementById('meu-palpite-container');
    const valorMeuPalpite = document.getElementById('meu-palpite-valor');

    tituloModal.innerText = `${nomeA} x ${nomeB}`;
    
    // Reseta estado do modal
    if (containerMeuPalpite) containerMeuPalpite.classList.add('hidden');
    lista.innerHTML = '<tr><td class="p-4 text-center text-gray-400">Carregando...</td></tr>';
    document.getElementById('modal-apostas').classList.remove('hidden');

    // Busca o usuário logado e todas as apostas do jogo
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data: apostas } = await supabaseClient
        .from('apostas')
        .select('gols_a, gols_b, usuarios(nome, id)')
        .eq('jogo_id', jogoId);

    // 1. Identifica o palpite do usuário logado
    const minhaAposta = apostas?.find(a => a.usuarios?.id === user?.id);
    if (minhaAposta && containerMeuPalpite) {
        valorMeuPalpite.innerText = `${minhaAposta.gols_a} x ${minhaAposta.gols_b}`;
        containerMeuPalpite.classList.remove('hidden');
    }

    // 2. Filtra outras apostas (remove o usuário logado da lista principal)
    const outrasApostas = apostas?.filter(a => a.usuarios?.id !== user?.id) || [];

    if (!apostas || apostas.length === 0) {
        lista.innerHTML = '<tr><td class="p-4 text-center text-gray-400">Ninguém apostou neste jogo.</td></tr>';
        return;
    }

    // 3. Criar os grupos apenas com outras apostas
    const grupos = { vitoriaA: [], vitoriaB: [], empate: [] };

    outrasApostas.forEach(a => {
        if (a.gols_a > a.gols_b) grupos.vitoriaA.push(a);
        else if (a.gols_b > a.gols_a) grupos.vitoriaB.push(a);
        else grupos.empate.push(a);
    });

    const ordenar = (a, b) => (a.gols_a - b.gols_a) || (a.gols_b - b.gols_b);
    grupos.vitoriaA.sort(ordenar);
    grupos.vitoriaB.sort(ordenar);
    grupos.empate.sort(ordenar);

    // 4. Função auxiliar de renderização
    const gerarSecao = (titulo, listaApostas) => {
        if (listaApostas.length === 0) return '';
        return `
            <tr><td colspan="2" class="bg-gray-800 text-emerald-500 font-bold text-sm uppercase">
                <span class="bg-black/20 w-full flex rounded-lg px-4 py-4 mb-6">
                    ${titulo}
                </span>
            </td></tr>
            ${listaApostas.map(a => `
                <tr class="border-b border-gray-700/50">
                    <td class="py-3 text-gray-200">${a.usuarios?.nome || 'Anon'}</td>
                    <td class="py-3 text-center text-emerald-400 font-bold">${a.gols_a} x ${a.gols_b}</td>
                </tr>
            `).join('')}
            <tr><td colspan="2" class="h-16"></td></tr>
        `;
    };

    // 5. Renderiza na tabela
    if (outrasApostas.length === 0) {
        lista.innerHTML = '<tr><td class="p-4 text-center text-gray-400">Você é o único que apostou até agora!</td></tr>';
    } else {
        lista.innerHTML = 
            gerarSecao(`Vitória ${nomeA}`, grupos.vitoriaA) +
            gerarSecao(`Vitória ${nomeB}`, grupos.vitoriaB) +
            gerarSecao('Empate', grupos.empate);
    }
}

function fecharModal() {
    document.getElementById('modal-apostas').classList.add('hidden');
}

function rolarParaUltimoResultado() {
    const ultimo = document.getElementById('ultimo-placar-oficial');
    if (!ultimo) return;

    // Calcula a posição do topo do elemento relativo ao topo da página
    const posicaoTopo = ultimo.getBoundingClientRect().top + window.scrollY;
    
    // O valor 100 (ou mais) é a altura da sua navbar. 
    // Ajuste este número até ficar perfeito visualmente.
    const margemNavbar = 120; 

    window.scrollTo({
        top: posicaoTopo - margemNavbar,
        behavior: 'smooth'
    });
}

// btnLogout.addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = "index.html"; });

btnsLogout.forEach(botao => {
    botao.addEventListener('click', async () => { 
        await supabaseClient.auth.signOut(); 
        window.location.href = "index.html"; 
    });
});

document.getElementById('modal-apostas').addEventListener('click', (e) => {
    // Se o elemento clicado for o fundo (e não o conteúdo interno), fecha
    if (e.target.id === 'modal-apostas') {
        fecharModal();
    }
});

// document.addEventListener('DOMContentLoaded', verificarSessao);
document.addEventListener('DOMContentLoaded', () => {
    carregarSaudacao();
    verificarSessao();
});

document.getElementById('btn-fechar-modal').addEventListener('click', fecharModal);
window.fecharModal = fecharModal;