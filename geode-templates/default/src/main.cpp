{%- if comments -%}
/**
 * Include the Geode headers.
 */
{% endif -%}
#include <Geode/Geode.hpp>
{% if comments %}
/**
 * Brings cocos2d and all Geode namespaces to the current scope.
 */
{%- endif %}
using namespace geode::prelude;
{% if comments %}
/**
 * `$modify` lets you extend and modify GD's classes.
 * To hook a function in Geode, simply $modify the class
 * and write a new function definition with the signature of
 * the function you want to hook.
 *
 * Here we use the overloaded `$modify` macro to set our own class name,
 * so that we can use it for button callbacks.
 *
 * Notice the header being included, you *must* include the header for
 * the class you are modifying, or you will get a compile error.
 *
 * Another way you could do this is like this:
 *
 * struct MyMenuLayer : Modify<MyMenuLayer, MenuLayer> {};
 */
{%- endif %}
#include <Geode/modify/MenuLayer.hpp>
class $modify(MyMenuLayer, MenuLayer) {
{%- if comments %}
	/**
	 * Typically classes in GD are initialized using the `init` function, (though not always!),
	 * so here we use it to add our own button to the bottom menu.
	 *
	 * Note that for all hooks, your signature has to *match exactly*,
	 * `void init()` would not place a hook!
	*/
{%- endif %}
	bool init() {
{%- if comments %}
		/**
		 * We call the original init function so that the
		 * original class is properly initialized.
		 */
{%- endif %}
		if (!MenuLayer::init()) {
			return false;
		}
{% if comments %}
		/**
		 * You can use methods from the `geode::log` namespace to log messages to the console,
		 * being useful for debugging and such. See this page for more info about logging:
		 * https://docs.geode-sdk.org/tutorials/logging
		*/
{%- endif %}
		log::debug("Hello from my MenuLayer::init hook! This layer has {} children.", this->getChildrenCount());
{% if comments %}
		/**
		 * See this page for more info about buttons
		 * https://docs.geode-sdk.org/tutorials/buttons
		*/
{%- endif %}
		auto myButton = CCMenuItemSpriteExtra::create(
			CCSprite::createWithSpriteFrameName("GJ_likeBtn_001.png"),
			this,
{%- if comments %}
			/**
			 * Here we use the name we set earlier for our modify class.
			*/
{%- endif %}
			menu_selector(MyMenuLayer::onMyButton)
		);
{% if comments %}
		/**
		 * Here we access the `bottom-menu` node by its ID, and add our button to it.
		 * Node IDs are a Geode feature, see this page for more info about it:
		 * https://docs.geode-sdk.org/tutorials/nodetree
		*/
{%- endif %}
		auto menu = this->getChildByID("bottom-menu");
		menu->addChild(myButton);
{% if comments %}
		/**
		 * The `_spr` string literal operator just prefixes the string with
		 * your mod id followed by a slash. This is good practice for setting your own node ids.
		*/
{%- endif %}
		myButton->setID("my-button"_spr);
{% if comments %}
		/**
		 * We update the layout of the menu to ensure that our button is properly placed.
		 * This is yet another Geode feature, see this page for more info about it:
		 * https://docs.geode-sdk.org/tutorials/layouts
		*/
{%- endif %}
		menu->updateLayout();
{% if comments %}
		/**
		 * We return `true` to indicate that the class was properly initialized.
		 */
{%- endif %}
		return true;
	}
{% if comments %}
	/**
	 * This is the callback function for the button we created earlier.
	 * The signature for button callbacks must always be the same,
	 * return type `void` and taking a `CCObject*`.
	*/
{%- endif %}
	void onMyButton(CCObject*) {
		FLAlertLayer::create("Geode", "Hello from my custom mod!", "OK")->show();
	}
};