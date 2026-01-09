<?php
/**
 * Plugin Name:       COD Price Widget
 * Description:       Replaces Yandex Market widgets with Click or Die price widgets.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Roman Zagrebin
 * License:           GPL-2.0-or-later
 * Text Domain:       cod-price-widget
 *
 * @package CodPriceWidget
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'COD_PRICE_WIDGET_VERSION', '1.0.0' );

class CodPriceWidgetPlugin {
	
	private $api_base_url;
	
	public function __construct() {
		$this->api_base_url = get_option( 'cod_price_widget_api_url', 'http://localhost:1488' );
		
		add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
		add_action( 'admin_init', array( $this, 'admin_init' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
		
		// Filter content to replace Yandex widgets
		add_filter( 'the_content', array( $this, 'replace_yandex_widgets' ), 20 );
	}
	
	public function enqueue_scripts() {
		// Enqueue HTMX (may already be loaded by ratings plugin)
		if ( ! wp_script_is( 'htmx', 'registered' ) ) {
			wp_enqueue_script( 'htmx', 'https://unpkg.com/htmx.org@2.0.4', array(), '2.0.4', true );
		} else {
			wp_enqueue_script( 'htmx' );
		}
		
		// Inline styles for widget container
		wp_add_inline_style( 'wp-block-library', '
			.cod-price-widget-container {
				margin: 1.5em 0;
			}
			.cod-price-widget-loading {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 2rem;
				background: #f9fafb;
				border-radius: 1rem;
				border: 1px solid #e5e7eb;
			}
			.cod-price-widget-loading .spinner {
				width: 24px;
				height: 24px;
				border: 2px solid #e5e7eb;
				border-top-color: #6b7280;
				border-radius: 50%;
				animation: cod-spin 0.8s linear infinite;
			}
			@keyframes cod-spin {
				to { transform: rotate(360deg); }
			}
		' );
	}
	
	/**
	 * Replace Yandex Market widget blocks with COD price widgets
	 * 
	 * widget-35: Section with article content + embedded widget - preserve section, replace only widget parts
	 * widget-39: Standalone widget block - replace entire section
	 */
	public function replace_yandex_widgets( $content ) {
		if ( empty( $content ) ) {
			return $content;
		}
		
		$api_url = $this->api_base_url;
		
		// widget-35: Preserve section content, replace only the Yandex widget parts
		// Remove the marketWidget div and its following script
		$content = preg_replace_callback(
			'/<section\s+class="([^"]*wp-block-cgb-block-widget-35[^"]*)"([^>]*)>(.*?)<\/section>/s',
			function( $matches ) use ( $api_url ) {
				$class = $matches[1];
				$attrs = $matches[2];
				$inner = $matches[3];
				
				// Extract searchText from the script
				if ( ! preg_match( '/searchText:\s*"([^"]+)"/', $inner, $search_match ) ) {
					return $matches[0]; // No searchText found, return unchanged
				}
				$model = trim( $search_match[1] );
				
				// Remove the Yandex widget script tag (async src with market.yandex.ru)
				$inner = preg_replace( '/<script[^>]*src="[^"]*aflt\.market\.yandex\.ru[^"]*"[^>]*><\/script>/s', '', $inner );
				
				// Remove the marketWidget div
				$inner = preg_replace( '/<div\s+id="marketWidget-[^"]*"><\/div>/s', '', $inner );
				
				// Remove the YaMarketAffiliate.createWidget script block
				$inner = preg_replace( '/<script>\s*\(function\s*\(w\)\s*\{[^<]*YaMarketAffiliate\.createWidget[^<]*<\/script>/s', '', $inner );
				
				// Build COD widget
				$encoded_model = urlencode( $model );
				$widget_url = "{$api_url}/widget/v1/price?model={$encoded_model}";
				$cod_widget = sprintf(
					'<div class="cod-price-widget-container not-prose" hx-get="%s" hx-trigger="load" hx-swap="innerHTML">
						<div class="cod-price-widget-loading">
							<div class="spinner"></div>
						</div>
					</div>',
					esc_url( $widget_url )
				);
				
				// Append COD widget before closing section
				return '<section class="' . $class . '"' . $attrs . '>' . $inner . $cod_widget . '</section>';
			},
			$content
		);
		
		// widget-39: Standalone widget - replace entire section
		$content = preg_replace_callback(
			'/<section\s+class="[^"]*wp-block-cgb-block-widget-39[^"]*"[^>]*>.*?searchText:\s*"([^"]+)".*?<\/section>/s',
			function( $matches ) use ( $api_url ) {
				$model = trim( $matches[1] );
				$encoded_model = urlencode( $model );
				$widget_url = "{$api_url}/widget/v1/price?model={$encoded_model}";
				
				return sprintf(
					'<div class="cod-price-widget-container not-prose" hx-get="%s" hx-trigger="load" hx-swap="innerHTML">
						<div class="cod-price-widget-loading">
							<div class="spinner"></div>
						</div>
					</div>',
					esc_url( $widget_url )
				);
			},
			$content
		);
		
		return $content;
	}
	
	public function add_admin_menu() {
		add_options_page(
			'COD Price Widget Settings',
			'COD Price Widget',
			'manage_options',
			'cod-price-widget-settings',
			array( $this, 'settings_page' )
		);
	}
	
	public function admin_init() {
		register_setting( 'cod_price_widget_settings', 'cod_price_widget_api_url' );
		
		add_settings_section(
			'cod_price_widget_main_section',
			'API Settings',
			null,
			'cod_price_widget_settings'
		);
		
		add_settings_field(
			'cod_price_widget_api_url',
			'Scraper API URL',
			array( $this, 'api_url_field' ),
			'cod_price_widget_settings',
			'cod_price_widget_main_section'
		);
	}
	
	public function api_url_field() {
		$value = get_option( 'cod_price_widget_api_url', 'http://localhost:1488' );
		echo '<input type="url" name="cod_price_widget_api_url" value="' . esc_attr( $value ) . '" class="regular-text" />';
		echo '<p class="description">Scraper API base URL (e.g., http://localhost:1488 or https://scraper.click-or-die.ru)</p>';
	}
	
	public function settings_page() {
		?>
		<div class="wrap">
			<h1>COD Price Widget Settings</h1>
			<form method="post" action="options.php">
				<?php
				settings_fields( 'cod_price_widget_settings' );
				do_settings_sections( 'cod_price_widget_settings' );
				submit_button();
				?>
			</form>
			
			<h2>Test Widget</h2>
			<p>Enter a model name to test the widget replacement:</p>
			<input type="text" id="cod-test-model" value="Samsung Galaxy S25 Ultra" class="regular-text" />
			<button type="button" class="button" onclick="testWidget()">Test</button>
			<div id="cod-test-result" style="margin-top: 1rem;"></div>
			
			<script>
			function testWidget() {
				const model = document.getElementById('cod-test-model').value;
				const apiUrl = '<?php echo esc_js( get_option( 'cod_price_widget_api_url', 'http://localhost:1488' ) ); ?>';
				const url = apiUrl + '/widget/v1/price?model=' + encodeURIComponent(model);
				
				document.getElementById('cod-test-result').innerHTML = '<p>Loading from: ' + url + '</p>';
				
				fetch(url)
					.then(r => r.text())
					.then(html => {
						document.getElementById('cod-test-result').innerHTML = html;
					})
					.catch(err => {
						document.getElementById('cod-test-result').innerHTML = '<p style="color:red;">Error: ' + err.message + '</p>';
					});
			}
			</script>
		</div>
		<?php
	}
}

new CodPriceWidgetPlugin();
