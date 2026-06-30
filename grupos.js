import { supabaseClient } from './supabase-config.js';
import { carregarSaudacao } from './auth-header.js';

console.log("grupos 20260630 1500");

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

const STATUS_TRAVAS = {
    'A': false,
    'B': false, 'C': false, 'D': false, 'E': false, 
    'F': false, 'G': false, 'H': false, 'I': false, 
    'J': false, 'K': false, 'L': false
};

const btnsLogout = document.querySelectorAll('.btn-logout');

async function carregarEstrutura() {
    const container = document.getElementById('container-grupos');
    const { data: paises } = await supabaseClient
        .from('paises')
        .select('id, nome, grupo, sigla')
        .order('grupo')
        .order('posicao');

    if (!paises) return;

    const grupos = paises.reduce((acc, p) => {
        if (!acc[p.grupo]) acc[p.grupo] = [];
        acc[p.grupo].push({ id: p.id, nome: p.nome, sigla: p.sigla }); 
        return acc;
    }, {});

    Object.entries(grupos).forEach(([letra, lista]) => {
        const clone = document.importNode(document.getElementById('template-grupo').content, true);

        const btn = clone.querySelector('.ver-apostas');
        btn.dataset.grupo = letra; 
        btn.dataset.titulo = `Grupo ${letra}`;

        clone.querySelector('.grupo-titulo').textContent = `${letra}`;
        const divPrincipal = clone.querySelector('div');
        divPrincipal.id = `card-grupo-${letra}`;
        
        const grid = clone.querySelector('.grid-inputs');
        lista.forEach(pais => {
            const iClone = document.importNode(document.getElementById('template-input-pais').content, true);
            const img = iClone.querySelector('img');
            if (img) {
                img.src = `./assets/images/paises/${pais.id}.svg`; 
                img.setAttribute("title", pais.nome);
            }

            const spanNome = iClone.querySelector('.nome-pais');
            if (spanNome) {
                spanNome.appendChild(document.createTextNode(pais.sigla));
            }

            const input = iClone.querySelector('.grp-input');
            input.dataset.grupo = letra;
            input.dataset.pais = pais.nome;
            grid.appendChild(iClone);

            input.addEventListener('input', () => validarGrupo(letra));
        });
        container.appendChild(clone);
    });
    
    setTimeout(carregarDados, 300);
}

async function carregarDados() {
    const loader = document.getElementById('loader');

    try {

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const tempoMinimo = new Promise(resolve => setTimeout(resolve, 3000));

        const [p, g, r] = await Promise.all([
            supabaseClient.from('palpites').select('palpites_grupos').eq('usuario_id', user.id).single(),
            supabaseClient.from('grupos').select('*'),
            supabaseClient.from('pontuacao').select('*'),
            tempoMinimo
        ]);

        const TOTAL_GRUPOS = g.data ? g.data.length : 0;

        document.querySelectorAll('.pontos-individuais').forEach(s => s.textContent = '');

        if (p.data?.palpites_grupos) {
            Object.entries(p.data.palpites_grupos).forEach(([g, paises]) => {
                Object.entries(paises).forEach(([pais, val]) => {
                    const el = document.querySelector(`.grp-input[data-grupo="${g}"][data-pais="${pais}"]`);
                    if (el) {
                        el.value = val;
                        
                        // BUSCA PELO SPAN CORRETO (baseado na classe que definimos)
                        const displaySpan = el.parentElement.querySelector('.grp-display');
                        if (displaySpan) {
                            displaySpan.textContent = val;
                        }
                    }
                });
            });
        }

        const contagemAcertos = { 1: 0, 2: 0, 3: 0, 4: 0 };
        const gruposPerfeitos = [];

        if (g.data) {
            g.data.forEach(grupoDB => {
                const card = document.getElementById(`card-grupo-${grupoDB.grupo}`);
                if (!card) return;

                const gabarito = typeof grupoDB.classificacao === 'string' ? JSON.parse(grupoDB.classificacao) : grupoDB.classificacao;
                const palpite = {};
                card.querySelectorAll('.grp-input').forEach(i => palpite[i.dataset.pais] = parseInt(i.value) || 0);

                let acertosNoGrupo = 0;

                Object.entries(palpite).forEach(([pais, pos]) => {
                    const inputEl = card.querySelector(`.grp-input[data-pais="${pais}"]`);
                    const spanPontos = inputEl.parentElement.querySelector('.pontos-individuais');
                    
                    if (!spanPontos) return;
                    const grupoApurado = gabarito && Object.values(gabarito).some(valor => valor !== null);
                    
                    if (grupoApurado) {
                        // 2. Se está apurado, aplica a lógica de acerto ou erro ("-")
                        if (gabarito[pais] && pos === gabarito[pais]) {
                            acertosNoGrupo++;
                            contagemAcertos[pos]++;
                            
                            const regra = r.data.find(reg => reg.nome_reduzido === `${pos}ºGRP`);
                            spanPontos.textContent = `+${regra ? regra.pontos : 0}`;
                            spanPontos.className = "pontos-individuais text-sm text-gray-800 mt-1 bg-amber-400 rounded-full px-2 py-1";
                        } else {
                            spanPontos.textContent = "-";
                            spanPontos.className = "pontos-individuais text-sm text-gray-400 mt-1 bg-gray-700 rounded-full px-2 py-1 w-fit";
                        }
                        spanPontos.classList.remove("hidden");
                    } else {
                        // 3. Se não está apurado, esconde o span para não poluir a interface
                        spanPontos.classList.add("hidden");
                    }
                });
                if (acertosNoGrupo === 4) {
                    gruposPerfeitos.push(grupoDB.grupo);
                }
            });
        }

        atualizarBoxBonus(contagemAcertos, gruposPerfeitos, r.data, TOTAL_GRUPOS);

        const btnSalvar = document.getElementById('btn-salvar');
        if (btnSalvar && btnSalvar.disabled) {
            alternarModoVisualizacao(true);
        }

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

function atualizarBoxBonus(contagem, gruposPerfeitos, regras, totalGrupos) {
    const listaBonus = document.getElementById('lista-bonus');
    const divBox = document.getElementById('box-bonus');
    let bonusConfere = 0;
    if (!listaBonus) return;
    listaBonus.innerHTML = '';

    // Função auxiliar para criar a estrutura padrão de bônus
    const criarLinhaBonus = (pontos, texto) => {
        const div = document.createElement('div');
        div.className = "bonus-linha flex items-center gap-2";
        div.innerHTML = `
            <span class="bonus-pontos text-sm text-amber-400 mt-1 bg-gray-800 rounded-full px-2 py-1 w-12 text-center">+${pontos}</span>
            <p class="bonus-tipo text-sm">${texto}</p>
        `;
        return div;
    };

    // 1. Processar acertos de posições (1º, 2º, 3º, 4º)
    [1, 2, 3, 4].forEach(pos => {
        const codigo = `ALL${pos}º`; 
        const regra = regras.find(r => r.nome_reduzido === codigo);
        
        if (regra && contagem[pos] === totalGrupos) {
            const linha = criarLinhaBonus(regra.pontos, `Acertou ${regra.nome} dos Grupos`);
            bonusConfere += regra.pontos;
            listaBonus.appendChild(linha);
        }
    });

    // 2. Processar grupos perfeitos (4 acertos no grupo)
    if (gruposPerfeitos.length > 0) {
        const regraGrupo = regras.find(r => r.nome_reduzido === 'ALLGRP');
        if (regraGrupo) {
            const totalBonus = gruposPerfeitos.length * regraGrupo.pontos;
            const gruposOrdenados = gruposPerfeitos.sort().join(', ');
            const linha = criarLinhaBonus(totalBonus, `Acertou Grupo(s) Inteiro(s) : ${gruposOrdenados}`);
            bonusConfere += totalBonus;
            listaBonus.appendChild(linha);
        }
    }
    if (bonusConfere > 0) {
        divBox.classList.remove("hidden");
    }
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
    // 1. Trava os campos de input
    document.querySelectorAll('.grp-input').forEach(i => i.disabled = true);
    
    // 2. Troca a visibilidade dos botões de rodapé
    const btnSalvar = document.getElementById('btn-salvar-grupos');
    const btnEncerrado = document.getElementById('btn-encerrado');
    const instrucoes = document.getElementById('instrucoes');
    
    if (btnSalvar) btnSalvar.classList.add('hidden');
    if (btnEncerrado) btnEncerrado.classList.remove('hidden');
    
    // 3. Oculta instruções
    if (instrucoes) instrucoes.classList.add('hidden');
    
    // 4. (Opcional) Se você quiser que, ao travar, ele já converta 
    // os campos para visualização de texto:
    alternarModoVisualizacao(true);
}

async function salvar() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const dados = {};
    document.querySelectorAll('.grp-input').forEach(i => {
        if (!dados[i.dataset.grupo]) dados[i.dataset.grupo] = {};
        dados[i.dataset.grupo][i.dataset.pais] = parseInt(i.value) || 0;
    });
    const { error } = await supabaseClient.from('palpites').upsert({ usuario_id: user.id, palpites_grupos: dados });
    if (error) showToast("Erro ao salvar"); else { showToast("Grupos salvos!"); carregarDados(); }
}

document.getElementById('btn-salvar').addEventListener('click', salvar);

async function iniciarPagina() {
    await carregarEstrutura();
    await verificarPrazo();
}

const validarGrupo = (grupoLetra) => {
    const card = document.getElementById(`card-grupo-${grupoLetra}`);
    const inputs = card.querySelectorAll('.grp-input');
    const spanErro = card.querySelector('.erro-grupo');
    const btnSalvar = document.getElementById('btn-salvar');
    
    // 1. Limpa todos os estados de erro primeiro
    inputs.forEach(i => i.classList.remove('border-red-500', 'bg-red-900/20'));
    if (spanErro) spanErro.textContent = "";

    let temErro = false;
    let mensagemErro = "";

    // 2. Primeiro verifica erros de intervalo (0, 5, 6...)
    inputs.forEach(i => {
        const val = parseInt(i.value);
        if (i.value !== '' && (val < 1 || val > 4)) {
            i.classList.add('border-red-500', 'bg-red-900/20');
            temErro = true;
            mensagemErro = "Os números devem ser de 1 a 4";
        }
    });

    // 3. Se não houver erro de intervalo, verifica duplicidade em TODOS
    if (!temErro) {
        // Cria um mapa de valores encontrados
        const contagem = {};
        inputs.forEach(i => {
            const val = i.value;
            if (val !== '') {
                if (!contagem[val]) contagem[val] = [];
                contagem[val].push(i);
            }
        });

        // Marca todos os inputs que possuem valores repetidos
        Object.keys(contagem).forEach(val => {
            if (contagem[val].length > 1) {
                contagem[val].forEach(inputEl => {
                    inputEl.classList.add('border-red-500', 'bg-red-900/20');
                });
                temErro = true;
                mensagemErro = "Não pode repetir números";
            }
        });
    }

    // 4. Exibe mensagem e trava botão
    if (spanErro) {
        spanErro.textContent = temErro ? mensagemErro : "";
        spanErro.classList.toggle('text-red-500', temErro);
    }

    btnSalvar.disabled = temErro;
    btnSalvar.classList.toggle('opacity-50', temErro);
    btnSalvar.classList.toggle('cursor-not-allowed', temErro);
};

function alternarModoVisualizacao(modoSpan) {
    document.querySelectorAll('.grp-input').forEach(input => {
        const span = input.parentElement.querySelector('.grp-display');
        if (!span) return;
        
        if (modoSpan) {
            span.textContent = input.value; // Garante que o número está lá
            input.classList.add('hidden');  // Esconde o input
            span.classList.remove('hidden'); // Mostra o span
        } else {
            input.classList.remove('hidden');
            span.classList.add('hidden');
        }
    });
}

function fecharModal() {
    document.getElementById('modal-apostas').classList.add('hidden');
    document.body.classList.remove('modal-aberto');
}

async function abrirModalClassificacao(grupo, titulo) {
    document.body.classList.add('modal-aberto');
    
    document.getElementById('modal-loader').classList.remove('hidden'); 
    document.getElementById('modal-apostas').classList.remove('hidden');

    document.querySelector('#modal-apostas h3').textContent = titulo;
    const lista = document.getElementById('lista-apostas-modal');

    const { data: { user } } = await supabaseClient.auth.getUser();

    const [{ data: paises }, { data: palpitesRegistrados }] = await Promise.all([
        supabaseClient.from('paises').select('id, nome, sigla').eq('grupo', grupo).order('id'),
        supabaseClient.from('palpites').select('palpites_grupos, usuario_id')
    ]);

    // 2. BUSCA OS NOMES DOS USUÁRIOS
    const idsUsuarios = palpitesRegistrados.map(p => p.usuario_id);
    const { data: usuarios } = await supabaseClient
        .from('usuarios')
        .select('id, nome')
        .in('id', idsUsuarios);

    // 2. Busca O SEU palpite específico para este grupo
    const meuPalpite = palpitesRegistrados.find(p => p.usuario_id === user.id);
    const containerPalpite = document.getElementById('meu-palpite-container');
    const spanPalpite = document.getElementById('meu-palpite-valor');

    if (meuPalpite && meuPalpite.palpites_grupos[grupo]) {
        const meuJson = meuPalpite.palpites_grupos[grupo]; // Ex: {"Brasil": 1, "Marrocos": 2...}
        
        // Converte o objeto {Pais: Posicao} para um array ordenado [1, 2, 3, 4]
        const ordem = [null, null, null, null];
        Object.entries(meuJson).forEach(([nomePais, pos]) => {
            const pais = paises.find(p => p.nome === nomePais);
            if (pais) ordem[pos - 1] = pais.sigla;
        });

        // Formata: "BRA - MAR - HAI - ESC"
        spanPalpite.textContent = ordem.join(' - ');
        containerPalpite.classList.remove('hidden');
    } else {
        containerPalpite.classList.add('hidden');
    }

    if (!palpitesRegistrados) return;

    // DEFINA AS CORES AQUI DENTRO para garantir o escopo
    const cores = ['#ffdf20', '#e5e5e5', '#e17100', '#4a5565'];

    const IDs = ['A', 'B', 'C', 'D'];
    
    paises.forEach((pais, index) => {
        const id = IDs[index];
        const canvas = document.getElementById(`canvas-bar-${id}`);
        
        // --- ADICIONE ESTA LINHA PARA GARANTIR TAMANHO ---
        if(canvas) {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        }

        document.getElementById(`sigla-${id}`).textContent = pais.sigla;
        document.querySelector(`#band-${id} img`).src = `./assets/images/paises/${pais.id}.svg`;

        const stats = { 1: 0, 2: 0, 3: 0, 4: 0 };
        
        palpitesRegistrados.forEach(registro => {
            const json = registro.palpites_grupos; 
            if (json && json[grupo] && json[grupo][pais.nome]) {
                const posicao = json[grupo][pais.nome];
                if (posicao >= 1 && posicao <= 4) stats[posicao]++;
            }
        });

        // Passa o array de cores para o desenharBarra também!
        desenharBarra(canvas, stats, cores);

        if (estaBloqueado(grupo)) {
            lista.innerHTML = `
                <tr>
                    <td class="text-center text-gray-500">
                        <div class="flex flex-col items-center justify-center h-64">
                            <iconify-icon icon="gg:lock" class="text-5xl mb-4 text-emerald-600 block"></iconify-icon>
                            <p class="font-bold">Palpites Ocultos</p>
                            <p class="text-xs">Será revelado quando acabar a segunda rodada...</p>
                        </div>
                    </td>
                </tr>`;
        } else {
            // 1. Limpa a lista
            lista.innerHTML = '';

            // 2. ORDENA OS USUÁRIOS ALFABETICAMENTE
            // Se o usuário não tiver nome (fallback "Participante"), ele vai para o final ou início dependendo da lógica
            usuarios.sort((a, b) => a.nome.localeCompare(b.nome));

            // 3. Itera sobre os usuários ordenados e busca o palpite correspondente
            usuarios.forEach(usuario => {
                // --- ADICIONE ESTA LINHA ---
                // Pula o seu próprio palpite se o ID do usuário da lista for o seu
                if (usuario.id === user.id) return; 
                // ---------------------------

                const registro = palpitesRegistrados.find(p => p.usuario_id === usuario.id);
                
                if (registro && registro.palpites_grupos && registro.palpites_grupos[grupo]) {
                    const palpitesDoParticipante = registro.palpites_grupos[grupo]; 
                    
                    const ordem = [null, null, null, null];
                    
                    Object.entries(palpitesDoParticipante).forEach(([nomePais, pos]) => {
                        const pais = paises.find(p => p.nome === nomePais);
                        if (pais && pos >= 1 && pos <= 4) {
                            ordem[pos - 1] = pais.sigla;
                        }
                    });

                    const tr = document.createElement('tr');
                    tr.className = "border-b border-gray-800 hover:bg-gray-800/50";
                    tr.innerHTML = `
                        <td class="py-3 px-4 ">
                            <div>
                                ${usuario.nome}
                                <br>
                                <span class="py-3 text-right text-emerald-400">${ordem.join(' - ')}</span>
                            </div>
                        </td> 
                    `;
                    lista.appendChild(tr);
                }
            });
        }

    });

    // Pinta as legendas
    const legendas = document.querySelectorAll('.legenda-bolinha'); 
    legendas.forEach((el, i) => {
        if (i < cores.length) {
            el.style.backgroundColor = cores[i];
        }
    });

    document.getElementById('modal-loader').classList.add('hidden');
}

function desenharBarra(canvas, stats, cores) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const total = (stats[1] + stats[2] + stats[3] + stats[4]) || 0;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (total === 0) return;
    
    let x = 0;
    [1, 2, 3, 4].forEach((pos, i) => {
        const largura = (stats[pos] / total) * canvas.width;
        if (largura > 0) {
            ctx.fillStyle = cores[i]; // Usa as cores passadas por parâmetro
            ctx.fillRect(x, 0, largura, canvas.height);
            x += largura;
        }
    });
}

function estaBloqueado(coluna) {
    // Se não estiver no objeto, assume que está bloqueado (por segurança)
    return STATUS_TRAVAS.hasOwnProperty(coluna) ? STATUS_TRAVAS[coluna] : true;
}

btnsLogout.forEach(botao => {
    botao.addEventListener('click', async () => { 
        await supabaseClient.auth.signOut(); 
        window.location.href = "index.html"; 
    });
});

// document.addEventListener('DOMContentLoaded', iniciarPagina);
document.addEventListener('DOMContentLoaded', () => {
    carregarSaudacao();
    iniciarPagina();
});

document.getElementById('modal-apostas').addEventListener('click', (e) => {
    // Se o elemento clicado for o fundo (e não o conteúdo interno), fecha
    if (e.target.id === 'modal-apostas') {
        fecharModal();
    }
});

// Este listener é colocado no elemento PAI que SEMPRE existe (container-grupos)
document.getElementById('container-grupos').addEventListener('click', (e) => {
    // Procura o botão mais próximo, mesmo que o clique tenha sido no ícone dentro dele
    const btn = e.target.closest('.ver-apostas');
    
    if (btn) {
        // console.log("Botão clicado! Grupo:", btn.dataset.grupo);
        const grupo = btn.dataset.grupo;
        const titulo = btn.dataset.titulo;
        
        // Chama a função
        abrirModalClassificacao(grupo, titulo);
    }
});
document.getElementById('btn-fechar-modal').addEventListener('click', fecharModal);
window.fecharModal = fecharModal;
