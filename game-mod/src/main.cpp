
#include <Geode/Geode.hpp>
#include <Geode/modify/MenuLayer.hpp>

using namespace geode::prelude;

class $modify(ModderMenuLayer, MenuLayer) {
    bool init() {
        if (!MenuLayer::init()) {
            return false;
        }

        // Find Geometry Dash's existing bottom menu.
        auto menu = this->getChildByID("bottom-menu");

        if (!menu) {
            log::warn("Modder: bottom menu was not found.");
            return true;
        }

        // Create the Modder button using a built-in game sprite.
        auto sprite =
            CCSprite::createWithSpriteFrameName(
                "GJ_likeBtn_001.png"
            );

        if (!sprite) {
            log::warn("Modder: button sprite was not found.");
            return true;
        }

        auto button = CCMenuItemSpriteExtra::create(
            sprite,
            this,
            menu_selector(ModderMenuLayer::onModderClicked)
        );

        button->setID("modder-button"_spr);

        menu->addChild(button);
        menu->updateLayout();

        log::info("Modder menu button loaded!");

        return true;
    }

    void onModderClicked(CCObject*) {
        FLAlertLayer::create(
            "Modder v0.4",
            "Welcome to Modder!\n\n"
            "Geometry Dash integration is working.\n"
            "Online mod browsing is coming soon.",
            "OK"
        )->show();
    }
};
